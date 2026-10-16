// quote_invoice: invoice amount in NGN/USD/GHS/KES/USDC -> exact USDC to send. IMPLEMENTED.
import type { McpServer } from "@modelcontextprotocol/server";
import { quote } from "../lib/rates.js";
import { log } from "../lib/http.js";
import { fail, ok } from "../lib/result.js";
import { quoteInvoiceInput, quoteOutput } from "../schemas.js";

export function register(server: McpServer) {
  server.registerTool(
    "quote_invoice",
    {
      title: "Quote invoice in USDC",
      description:
        "Converts an invoice amount (NGN, USD, GHS, KES or USDC) to USDC on Base using live Coinbase rates, cross-checked against open.er-api.com. Rounds up to 6 decimals. Read-only.",
      inputSchema: quoteInvoiceInput,
      outputSchema: quoteOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ amount, currency }) => {
      try {
        const q = await quote(amount, currency);
        const cross = q.crossCheckRate ? ` (cross-check ${q.crossCheckRate}, Δ ${q.deviationPct}%)` : "";
        return ok(`${amount} ${currency} = ${q.usdcAmount} USDC at ${q.rate} ${currency}/USDC${cross}.`, q);
      } catch (e) {
        log(`quote failed: ${e instanceof Error ? e.message : "error"}`);
        return fail("Could not fetch live exchange rates. Retry explicitly in a moment.");
      }
    },
  );
}
