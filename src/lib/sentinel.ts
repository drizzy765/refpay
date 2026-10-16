// Gathers Sentinel data in parallel and runs the pure rule engine.
// Failures degrade to *_UNAVAILABLE reasons (never to a silent LOW).
import { settings } from "../config.js";
import type { SentinelReport } from "../schemas.js";
import { getTransfers } from "./alchemy.js";
import { addressSecurity } from "./goplus.js";
import { log } from "./http.js";
import { evaluate } from "./risk.js";

export async function runSentinel(payer: string, payee: string, usdcAmount: string): Promise<SentinelReport> {
  const s = settings();
  const [outgoing, incoming, goplus] = await Promise.allSettled([
    getTransfers({ fromAddress: payer, usdcOnly: true }),
    getTransfers({ toAddress: payer, usdcOnly: false }),
    addressSecurity(payee),
  ]);
  for (const [name, r] of [["alchemy-out", outgoing], ["alchemy-in", incoming], ["goplus", goplus]] as const) {
    if (r.status === "rejected") log(`${name} unavailable: ${r.reason instanceof Error ? r.reason.message : "error"}`);
  }
  return evaluate({
    payer,
    payee,
    usdcAmount: Number(usdcAmount),
    outgoing: outgoing.status === "fulfilled" ? outgoing.value : null,
    incoming: incoming.status === "fulfilled" ? incoming.value : null,
    goplus: goplus.status === "fulfilled" ? goplus.value : null,
    thresholds: { largeAbsUsdc: s.largeAbsUsdc, largeMedianMultiple: s.largeMedianMultiple, dustUsdc: s.dustUsdc },
  });
}

export function summarize(r: SentinelReport): string {
  const top = r.reasons.filter((x) => x.severity !== "info").map((x) => `- ${x.detail}`).join("\n");
  return `Sentinel risk: ${r.level} (score ${r.score}/100).${top ? `\n${top}` : ""}`;
}
