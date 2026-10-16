// Shared zod schemas. All objects are .strict() so the generated JSON Schema is closed,
// matching the PayBox starter style. Keep every schema self-contained (no remote $ref).
import * as z from "zod/v4";
import { SUPPORTED_CURRENCIES } from "./config.js";

export const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "20-byte hex address");
/** Non-negative decimal string, no exponent, e.g. "50000" or "37.55". */
export const decimalString = z.string().regex(/^(0|[1-9][0-9]{0,17})(\.[0-9]{1,18})?$/, "decimal string");
/** USDC amount with at most 6 decimals. */
export const usdcAmount = z.string().regex(/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/, "USDC amount, max 6 decimals");
export const currency = z.enum(SUPPORTED_CURRENCIES);
/** Invoice reference written on-chain. ASCII only so it reads cleanly on Basescan. Max 48 bytes. */
export const invoiceReference = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._\/#-]{0,47}$/, "1-48 chars: letters, digits, . _ / # -");
export const isoTimestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

export const riskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "BLOCK"]);
export type RiskLevel = z.infer<typeof riskLevel>;

export const riskReason = z.object({
  code: z.enum([
    "GOPLUS_MALICIOUS",
    "GOPLUS_SUSPICIOUS",
    "LOOKALIKE_ADDRESS",
    "DUST_FROM_PAYEE",
    "NEW_PAYEE",
    "LARGE_AMOUNT",
    "VERY_LARGE_AMOUNT",
    "PAYEE_IS_CONTRACT",
    "HISTORY_UNAVAILABLE",
    "GOPLUS_UNAVAILABLE",
    "SELF_PAYMENT",
    "KNOWN_PAYEE",
  ]),
  severity: z.enum(["info", "warn", "high", "block"]),
  points: z.number().int(),
  detail: z.string().max(300),
}).strict();
export type RiskReason = z.infer<typeof riskReason>;

// ---------- parse_invoice ----------
export const parseInvoiceInput = z.object({
  text: z.string().min(1).max(8000).describe("Raw invoice text, e.g. a pasted WhatsApp message or email body."),
}).strict();
export const parsedInvoice = z.object({
  payeeName: z.string().max(120).nullable(),
  payeeAddress: evmAddress.nullable(),
  amount: decimalString.nullable(),
  currency: currency.nullable(),
  reference: invoiceReference.nullable(),
  dueDate: z.string().max(40).nullable(),
  description: z.string().max(300).nullable(),
  missingFields: z.array(z.enum(["payeeAddress", "amount", "currency", "reference"])),
  warnings: z.array(z.string().max(300)).max(10),
}).strict();
export type ParsedInvoice = z.infer<typeof parsedInvoice>;

// ---------- quote_invoice ----------
export const quoteInvoiceInput = z.object({
  amount: decimalString.describe("Invoice amount in the invoice currency, as a decimal string."),
  currency: currency,
}).strict();
export const quoteOutput = z.object({
  amount: decimalString,
  currency: currency,
  usdcAmount: usdcAmount.describe("Amount of USDC to send, rounded UP to 6 decimals."),
  usdcAtomic: z.string().regex(/^[0-9]+$/),
  rate: z.string().describe("Invoice-currency units per 1 USDC (Coinbase)."),
  crossCheckRate: z.string().nullable().describe("Units per 1 USD from open.er-api.com, null for USD/USDC or if unavailable."),
  deviationPct: z.number().nullable(),
  source: z.literal("api.coinbase.com"),
  quotedAt: isoTimestamp,
  warnings: z.array(z.string().max(300)).max(10),
}).strict();
export type QuoteOutput = z.infer<typeof quoteOutput>;

// ---------- check_payee (Sentinel) ----------
export const checkPayeeInput = z.object({
  payer: evmAddress.describe("Public address of the PayBox wallet that will pay (the user's selected Base wallet)."),
  payee: evmAddress.describe("Address the invoice asks to be paid."),
  usdcAmount: usdcAmount,
}).strict();
export const sentinelReport = z.object({
  level: riskLevel,
  score: z.number().int().min(0).max(100),
  reasons: z.array(riskReason).max(20),
  priorPaymentsToPayee: z.number().int().min(0),
  lookalikeOf: evmAddress.nullable(),
  goplusFlags: z.array(z.string().max(64)).max(32),
  historyChecked: z.number().int().min(0),
  checkedAt: isoTimestamp,
}).strict();
export type SentinelReport = z.infer<typeof sentinelReport>;

// ---------- pay_invoice ----------
export const payInvoiceInput = z.object({
  payer: evmAddress.describe("Public address of the PayBox wallet that will pay. Used only for Sentinel history checks."),
  payee: evmAddress,
  usdcAmount: usdcAmount.describe("USDC to send, usually usdcAmount from quote_invoice."),
  reference: invoiceReference.describe("Invoice reference to embed in the transaction calldata."),
  acknowledgeRisk: z.boolean().optional().describe("Set true only after the user has explicitly accepted a HIGH Sentinel risk. BLOCK can never be overridden."),
}).strict();
// Output: the starter's evmOutputSchema (imported in the tool). Do not add keys; see ARCHITECTURE.md §4.4.

// ---------- verify_invoice_paid ----------
export const verifyPaidInput = z.object({
  payer: evmAddress,
  payee: evmAddress,
  reference: invoiceReference,
  usdcAmount: usdcAmount.optional(),
}).strict();
export const verifyPaidOutput = z.object({
  paid: z.boolean(),
  matchedBy: z.enum(["reference", "amount", "none"]),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).nullable(),
  blockNumber: z.number().int().nullable(),
  usdcAmount: usdcAmount.nullable(),
  explorerUrl: z.string().nullable(),
  checkedTransfers: z.number().int().min(0),
}).strict();
export type VerifyPaidOutput = z.infer<typeof verifyPaidOutput>;
