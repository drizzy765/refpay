// check_payee: Sentinel checks (rule-based) on the payee before paying.
// Wired end to end; data adapters in lib/alchemy.ts and lib/goplus.ts are TODO.
// Until they are implemented the report degrades to MEDIUM with *_UNAVAILABLE reasons.
import type { McpServer } from "@modelcontextprotocol/server";
import { runSentinel, summarize } from "../lib/sentinel.js";
import { ok } from "../lib/result.js";
import { checkPayeeInput, sentinelReport } from "../schemas.js";

export function register(server: McpServer) {
  server.registerTool(
    "check_payee",
    {
      title: "Sentinel payee check",
      description:
        "Checks a Base payee before paying: new vs known payee from your recent USDC history, address-poisoning lookalikes, dust transfers from the payee, unusually large amount, and GoPlus malicious-address flags. Returns LOW/MEDIUM/HIGH/BLOCK with reasons. Read-only.",
      inputSchema: checkPayeeInput,
      outputSchema: sentinelReport,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ payer, payee, usdcAmount }) => {
      const report = await runSentinel(payer, payee, usdcAmount);
      return ok(summarize(report), report);
    },
  );
}
