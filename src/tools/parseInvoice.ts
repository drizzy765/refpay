// parse_invoice: messy invoice text -> structured fields. Groq LLM with regex fallback.
import type { McpServer } from "@modelcontextprotocol/server";
import { SUPPORTED_CURRENCIES } from "../config.js";
import { callGroqJson, type GroqInvoiceJson } from "../lib/groq.js";
import { log } from "../lib/http.js";
import { ok } from "../lib/result.js";
import { decimalString, evmAddress, invoiceReference, parseInvoiceInput, parsedInvoice, type ParsedInvoice } from "../schemas.js";

const ADDRESS_RE = /0x[0-9a-fA-F]{40}/g;

/** Deterministic fallback when Groq is slow/unavailable. Good enough for the demo invoice. */
export function regexExtract(text: string): GroqInvoiceJson {
  const addresses = [...new Set(text.match(ADDRESS_RE) ?? [])];
  const cur = /₦|naira|\bngn\b/i.test(text) ? "NGN" : /gh₵|cedi|\bghs\b/i.test(text) ? "GHS" : /ksh|shilling|\bkes\b/i.test(text) ? "KES" : /\busdc\b/i.test(text) ? "USDC" : /\$|\busd\b/i.test(text) ? "USD" : null;
  const amt = /(?:₦|\$|ngn|usd|usdc|ghs|kes|ksh)\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k)?|([0-9][0-9,]*(?:\.[0-9]+)?)\s*(k)?\s*(?:naira|ngn|usd|usdc|ghs|kes)/i.exec(text);
  let amount: string | null = null;
  if (amt) {
    const raw = (amt[1] ?? amt[3] ?? "").replace(/,/g, "");
    const k = amt[2] ?? amt[4];
    amount = k ? String(Number(raw) * 1000) : raw;
  }
  const ref = /\b(?:inv(?:oice)?|ref(?:erence)?)\s*(?:no\.?|number|#|:)?\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9._\/#-]{1,47})/i.exec(text);
  return { payeeAddress: addresses.length === 1 ? addresses[0] : null, amount, currency: cur, reference: ref?.[1] ?? null };
}

/** Validate untrusted model/regex output field by field. Never "repair" an address. */
export function normalize(raw: GroqInvoiceJson, text: string, extraWarnings: string[] = []): ParsedInvoice {
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const warnings = [...extraWarnings];
  let payeeAddress = evmAddress.safeParse(raw.payeeAddress).success ? (raw.payeeAddress as string) : null;
  // Guard against hallucinated addresses: the address must appear verbatim in the source text.
  if (payeeAddress && !text.toLowerCase().includes(payeeAddress.toLowerCase())) {
    warnings.push("Model returned an address not present in the text; discarded.");
    payeeAddress = null;
  }
  const allAddrs = [...new Set((text.match(ADDRESS_RE) ?? []).map((a) => a.toLowerCase()))];
  if (allAddrs.length > 1) warnings.push(`Text contains ${allAddrs.length} different addresses; confirm the payee address with the sender.`);
  const amountRaw = typeof raw.amount === "number" ? String(raw.amount) : str(raw.amount, 40)?.replace(/,/g, "") ?? null;
  const amount = amountRaw && decimalString.safeParse(amountRaw).success ? amountRaw : null;
  const currency = (SUPPORTED_CURRENCIES as readonly string[]).includes(String(raw.currency)) ? (raw.currency as ParsedInvoice["currency"]) : null;
  const refRaw = str(raw.reference, 48);
  const reference = refRaw && invoiceReference.safeParse(refRaw).success ? refRaw : null;
  const missingFields = (
    [["payeeAddress", payeeAddress], ["amount", amount], ["currency", currency], ["reference", reference]] as const
  ).filter(([, v]) => v === null).map(([k]) => k);
  return {
    payeeName: str(raw.payeeName, 120),
    payeeAddress,
    amount,
    currency,
    reference,
    dueDate: str(raw.dueDate, 40),
    description: str(raw.description, 300),
    missingFields: [...missingFields],
    warnings: warnings.slice(0, 10),
  };
}

export function register(server: McpServer) {
  server.registerTool(
    "parse_invoice",
    {
      title: "Parse invoice",
      description:
        "Extracts payee address, amount, currency (NGN/USD/USDC/GHS/KES) and invoice reference from messy invoice or chat text. Read-only. Always show the result to the user before paying.",
      inputSchema: parseInvoiceInput,
      outputSchema: parsedInvoice,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ text }) => {
      let raw: GroqInvoiceJson;
      const warnings: string[] = [];
      try {
        raw = await callGroqJson(text);
      } catch (e) {
        log(`groq fallback: ${e instanceof Error ? e.message : "error"}`);
        raw = regexExtract(text);
        warnings.push("AI parser unavailable; used basic pattern matching. Double-check every field.");
      }
      const parsed = normalize(raw, text, warnings);
      const summary = `Payee ${parsed.payeeName ?? "?"} ${parsed.payeeAddress ?? "(no address)"} | ${parsed.amount ?? "?"} ${parsed.currency ?? "?"} | ref ${parsed.reference ?? "?"}`;
      return ok(summary, parsed);
    },
  );
}
