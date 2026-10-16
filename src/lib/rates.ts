// Fiat -> USDC quoting. IMPLEMENTED (verified live 2026-10-16):
//   GET https://api.coinbase.com/v2/exchange-rates?currency=USDC
//     -> { data: { currency: "USDC", rates: { NGN: "1331.41...", USD: "1", GHS: "11.66...", KES: "129.72..." } } }
//   GET https://open.er-api.com/v6/latest/USD
//     -> { result: "success", rates: { NGN: 1331.18, GHS: 11.66, KES: 129.75 }, time_last_update_utc: "..." }
// No API keys needed for either host.
import * as z from "zod/v4";
import { HOSTS, USDC_DECIMALS, settings, type Currency } from "../config.js";
import type { QuoteOutput } from "../schemas.js";
import { divCeilAtomic, formatAtomic } from "./decimal.js";
import { fetchJson, log } from "./http.js";

const coinbaseShape = z.object({ data: z.object({ currency: z.string(), rates: z.record(z.string(), z.string()) }) });
const erShape = z.object({ result: z.string(), rates: z.record(z.string(), z.number()) });

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export async function coinbaseRate(currency: Exclude<Currency, "USDC">): Promise<string> {
  const json = coinbaseShape.parse(await fetchJson(`https://${HOSTS.coinbase}/v2/exchange-rates?currency=USDC`));
  const r = json.data.rates[currency];
  if (!r || !/^\d+(\.\d+)?$/.test(r) || Number(r) <= 0) throw new Error(`Coinbase has no USDC/${currency} rate`);
  return r;
}

export async function erApiRate(currency: Exclude<Currency, "USDC" | "USD">): Promise<number> {
  const json = erShape.parse(await fetchJson(`https://${HOSTS.erApi}/v6/latest/USD`));
  const r = json.rates[currency];
  if (json.result !== "success" || r === undefined || !(r > 0)) throw new Error(`open.er-api has no USD/${currency} rate`);
  return r;
}

export async function quote(amount: string, currency: Currency): Promise<QuoteOutput> {
  const warnings: string[] = [];
  let rate = "1";
  let crossCheckRate: string | null = null;
  let deviationPct: number | null = null;

  if (currency !== "USDC") {
    // Run both in parallel to stay well inside the 10 s budget.
    const [cb, er] = await Promise.allSettled([
      coinbaseRate(currency),
      currency === "USD" ? Promise.resolve(null) : erApiRate(currency),
    ]);
    if (cb.status === "rejected") throw cb.reason;
    rate = cb.value;
    if (er.status === "fulfilled" && er.value !== null) {
      crossCheckRate = String(er.value);
      deviationPct = Math.round((Math.abs(Number(rate) - er.value) / er.value) * 10_000) / 100;
      if (deviationPct > settings().maxRateDeviationPct) {
        warnings.push(`Coinbase and open.er-api differ by ${deviationPct}% for ${currency}; confirm the amount with the payee.`);
      }
    } else if (er.status === "rejected") {
      log(`er-api cross-check failed for ${currency}`);
      warnings.push("Cross-check rate unavailable; quote uses Coinbase only.");
    }
  }

  const atomic = divCeilAtomic(amount, rate, USDC_DECIMALS);
  if (atomic === 0n) throw new Error("Amount converts to 0 USDC");
  return {
    amount,
    currency,
    usdcAmount: formatAtomic(atomic, USDC_DECIMALS),
    usdcAtomic: atomic.toString(),
    rate: Number(rate).toString(),
    crossCheckRate,
    deviationPct,
    source: "api.coinbase.com",
    quotedAt: nowIso(),
    warnings,
  };
}
