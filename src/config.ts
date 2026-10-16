// Central constants for RefPay. No network, no secrets, no side effects at import time.

export const PLUGIN_NAME = "refpay";
export const PLUGIN_VERSION = "0.1.0";
export const PROTOCOL_VERSION = "2026-07-28";

/** Base mainnet, canonical CAIP-2 id used in PayBox proposals. */
export const BASE_CHAIN = "eip155:8453" as const;
/** GoPlus uses the bare numeric chain id. */
export const BASE_CHAIN_ID = "8453";
/** Native USDC on Base (6 decimals). Same address the PayBox starter uses for x402. */
export const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;
export const USDC_DECIMALS = 6;

/**
 * Exact hostnames the hosted plugin calls. Every one must be added in the
 * developer portal under Test & configure > Network. No wildcards, no redirects.
 */
export const HOSTS = {
  groq: "api.groq.com",
  coinbase: "api.coinbase.com",
  erApi: "open.er-api.com",
  alchemyBase: "base-mainnet.g.alchemy.com",
  goplus: "api.gopluslabs.io",
} as const;

/** Per-request network timeout. Hosted budget is 10 s per operation INCLUDING sandbox startup. */
export const FETCH_TIMEOUT_MS = 4_000;
/** Groq gets a slightly tighter budget so parse_invoice always finishes well under 10 s. */
export const GROQ_TIMEOUT_MS = 4_000;

/**
 * Non-sensitive settings may be overridden with portal "Environment variable"s.
 * Read lazily (inside tool handlers), never at module load.
 */
export function settings() {
  const env = process.env;
  const num = (v: string | undefined, d: number) => (v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    groqModel: env.REFPAY_GROQ_MODEL?.trim() || "openai/gpt-oss-20b",
    /** Above this many USDC, a payment is "large" regardless of history. */
    largeAbsUsdc: num(env.REFPAY_LARGE_ABS_USDC, 1000),
    /** Above this multiple of the payer's median past USDC outflow, a payment is "large". */
    largeMedianMultiple: num(env.REFPAY_LARGE_MEDIAN_MULTIPLE, 3),
    /** Transfers below this USDC value count as dust (address-poisoning bait). */
    dustUsdc: num(env.REFPAY_DUST_USDC, 0.01),
    /** Max allowed % difference between Coinbase and open.er-api fiat rates. */
    maxRateDeviationPct: num(env.REFPAY_MAX_RATE_DEVIATION_PCT, 3),
    /** How many recent transfers to pull per direction from Alchemy. */
    historyCount: num(env.REFPAY_HISTORY_COUNT, 50),
  };
}

export const SUPPORTED_CURRENCIES = ["NGN", "USD", "USDC", "GHS", "KES"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
