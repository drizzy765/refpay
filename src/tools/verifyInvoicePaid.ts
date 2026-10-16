// verify_invoice_paid (optional, do last): find a payer->payee USDC transfer carrying the reference. STUB.
import type { McpServer } from "@modelcontextprotocol/server";
import { fail } from "../lib/result.js";
import { verifyPaidInput, verifyPaidOutput } from "../schemas.js";

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
      // TODO(agent):
      // 1. getTransfers({ fromAddress: payer, usdcOnly: true }) and keep t.to === payee (lowercase).
      // 2. For up to 5 newest matches: getTxInput(hash) -> decodeReferenceFromInput(input).
      //    reference match -> { paid: true, matchedBy: "reference", ... }
      // 3. Else if usdcAmount given and a transfer value equals it -> matchedBy: "amount".
      // 4. explorerUrl: `https://basescan.org/tx/${hash}`.
      void payer; void payee; void reference; void usdcAmount;
      return fail("verify_invoice_paid is not implemented yet.");
    },
  );
}
