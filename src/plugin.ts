// RefPay: AI invoice payments in USDC on Base, with the invoice reference on-chain
// and Sentinel payee checks. PayBox plugin entrypoint (bundled to dist/plugin.mjs).
//
// Rules: no network or env reads at module load or during tool listing. Log to stderr only.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { PLUGIN_NAME, PLUGIN_VERSION, PROTOCOL_VERSION } from "./config.js";
import { register as checkPayee } from "./tools/checkPayee.js";
import { register as parseInvoice } from "./tools/parseInvoice.js";
import { register as payInvoice } from "./tools/payInvoice.js";
import { register as quoteInvoice } from "./tools/quoteInvoice.js";
import { register as verifyInvoicePaid } from "./tools/verifyInvoicePaid.js";

function createServer() {
  const server = new McpServer(
    { name: PLUGIN_NAME, version: PLUGIN_VERSION },
    { supportedProtocolVersions: [PROTOCOL_VERSION] },
  );
  parseInvoice(server);
  quoteInvoice(server);
  checkPayee(server);
  payInvoice(server);
  verifyInvoicePaid(server);
  return server;
}

serveStdio(createServer, { legacy: "reject" });
