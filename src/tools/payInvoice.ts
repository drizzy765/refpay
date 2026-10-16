// pay_invoice: re-runs Sentinel, then returns ONE unsigned Base USDC transfer proposal with the
// invoice reference appended to calldata. PayBox handles wallet selection, approval (passkey) and signing.
// The plugin cannot force or skip approval; it can only refuse to propose.
import type { McpServer } from "@modelcontextprotocol/server";
import { getAddress } from "viem";
import { BASE_CHAIN, USDC_BASE, USDC_DECIMALS } from "../config.js";
import { log } from "../lib/http.js";
import { encodeTransferWithReference } from "../lib/memo.js";
import { fail } from "../lib/result.js";
import { runSentinel, summarize } from "../lib/sentinel.js";
import { atomicAmount, evmOutputSchema, proposeEvm } from "../paybox.js";
import { payInvoiceInput } from "../schemas.js";

export function register(server: McpServer) {
  server.registerTool(
    "pay_invoice",
    {
      title: "Pay invoice in USDC with on-chain reference",
      description:
        "Proposes a USDC transfer on Base to the payee with the invoice reference embedded in the transaction data, after Sentinel checks. Refuses BLOCK risk; refuses HIGH risk unless acknowledgeRisk is true. Nothing is signed: PayBox shows the transaction and asks the user to approve.",
      inputSchema: payInvoiceInput,
      outputSchema: evmOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ payer, payee, usdcAmount, reference, acknowledgeRisk }) => {
      const amount = BigInt(atomicAmount(usdcAmount, USDC_DECIMALS));
      if (amount === 0n) return fail("Amount must be greater than 0 USDC.");

      const risk = await runSentinel(payer, payee, usdcAmount);
      if (risk.level === "BLOCK") {
        return fail(`Refused: ${summarize(risk)}\nDo not pay this address. Confirm the correct address with the payee through another channel.`);
      }
      if (risk.level === "HIGH" && acknowledgeRisk !== true) {
        return fail(`Not proposed: ${summarize(risk)}\nIf the user explicitly accepts this risk, call pay_invoice again with acknowledgeRisk: true.`);
      }

      try {
        const data = encodeTransferWithReference(getAddress(payee), amount, reference);
        // TODO(agent): if the portal "Validate transaction" rejects the appended bytes, switch to
        // FALLBACK (ARCHITECTURE.md §7): set REFPAY_MEMO_MODE in config and use encodeTransfer()/MemoProxy.
        const proposal = proposeEvm({ chain: BASE_CHAIN, to: USDC_BASE, value: "0", data });
        const note =
          `Proposed ${usdcAmount} USDC to ${payee} on Base with reference "${reference}" in the transaction data. ` +
          `${summarize(risk)}\nPayBox will show the raw transaction (USDC contract ${USDC_BASE}, value 0) and ask you to approve. ` +
          `Nothing is sent until you approve. Proposal expires in ~4 minutes.`;
        return { ...proposal, content: [{ type: "text" as const, text: note }] };
      } catch (e) {
        log(`proposal failed: ${e instanceof Error ? e.message : "error"}`);
        return fail("Could not build the payment proposal. Check the address and amount.");
      }
    },
  );
}
