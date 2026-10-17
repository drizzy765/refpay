// verify_invoice_paid: find a payer->payee USDC transfer carrying the invoice reference
// (decodeReferenceFromInput), else fall back to matching the quoted USDC amount.
import type { McpServer } from "@modelcontextprotocol/server";
import { getTransfers, getTxInput } from "../lib/alchemy.js";
import { log } from "../lib/http.js";
import { decodeReferenceFromInput } from "../lib/memo.js";
import { fail, ok } from "../lib/result.js";
import { verifyPaidInput, verifyPaidOutput } from "../schemas.js";

const EXPLORER = "https://basescan.org/tx/";

/** Decimal number -> USDC string with at most 6 decimals and no trailing zeros. */
function formatUsdc(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function register(server: McpServer) {
  server.registerTool(
    "verify_invoice_paid",
    {
      title: "Verify invoice paid",
      description:
        "Checks Base for a USDC transfer from payer to payee whose transaction data carries the RefPay invoice reference. Read-only.",
      inputSchema: verifyPaidInput,
      outputSchema: verifyPaidOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ payer, payee, reference, usdcAmount }) => {
      let transfers;
      try {
        transfers = await getTransfers({ fromAddress: payer, usdcOnly: true });
      } catch (e) {
        log(`verify history: ${e instanceof Error ? e.message : "error"}`);
        return fail("Could not read payment history from Alchemy. Retry explicitly.");
      }

      const payeeL = payee.toLowerCase();
      const matches = transfers.filter((t) => t.to?.toLowerCase() === payeeL);

      // Reference match: inspect the input of the 5 newest payer->payee transfers.
      const recent = matches.slice(0, 5);
      const inputs = await Promise.all(recent.map((t) => getTxInput(t.hash).catch(() => null)));
      for (let i = 0; i < recent.length; i++) {
        const t = recent[i]!;
        if (inputs[i] && decodeReferenceFromInput(inputs[i]!) === reference) {
          return ok(`Paid: reference "${reference}" found in ${t.hash}.`, {
            paid: true,
            matchedBy: "reference",
            txHash: t.hash,
            blockNumber: t.blockNum,
            usdcAmount: formatUsdc(t.value),
            explorerUrl: `${EXPLORER}${t.hash}`,
            checkedTransfers: matches.length,
          });
        }
      }

      // Amount fallback: reference absent, but a transfer amount equals the quote.
      if (usdcAmount !== undefined) {
        const target = Number(usdcAmount);
        const amountMatch = matches.find((t) => t.value !== null && Math.abs(t.value - target) < 1e-9);
        if (amountMatch) {
          return ok(`Paid: matched ${usdcAmount} USDC to payee in ${amountMatch.hash}.`, {
            paid: true,
            matchedBy: "amount",
            txHash: amountMatch.hash,
            blockNumber: amountMatch.blockNum,
            usdcAmount,
            explorerUrl: `${EXPLORER}${amountMatch.hash}`,
            checkedTransfers: matches.length,
          });
        }
      }

      return ok(`No USDC payment from payer to payee found (checked ${matches.length} transfer(s)).`, {
        paid: false,
        matchedBy: "none",
        txHash: null,
        blockNumber: null,
        usdcAmount: null,
        explorerUrl: null,
        checkedTransfers: matches.length,
      });
    },
  );
}
