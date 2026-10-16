// Sentinel rule engine. IMPLEMENTED as a PURE function (no network) so it is unit-testable.
// The check_payee tool gathers data (Alchemy + GoPlus) and passes it here.
// Thresholds live in config.settings() and ARCHITECTURE.md §6. Rule-based on purpose: no ML.
import type { RiskLevel, RiskReason, SentinelReport } from "../schemas.js";
import type { Transfer } from "./alchemy.js";
import type { GoPlusResult } from "./goplus.js";

export interface SentinelInput {
  payer: string;
  payee: string;
  usdcAmount: number;
  /** payer -> anyone, USDC on Base, newest first. null = Alchemy unavailable. */
  outgoing: Transfer[] | null;
  /** anyone -> payer, any ERC-20 (fake tokens count), newest first. null = unavailable. */
  incoming: Transfer[] | null;
  goplus: GoPlusResult | null;
  thresholds: { largeAbsUsdc: number; largeMedianMultiple: number; dustUsdc: number };
  now?: Date;
}

const PREFIX = 4; // hex chars after 0x
const SUFFIX = 4;

export function isLookalike(a: string, b: string): boolean {
  const x = a.toLowerCase().slice(2);
  const y = b.toLowerCase().slice(2);
  if (x === y) return false;
  return x.slice(0, PREFIX) === y.slice(0, PREFIX) && x.slice(-SUFFIX) === y.slice(-SUFFIX);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : ((s[m - 1]! + s[m]!) / 2);
}

export function levelFor(score: number, reasons: RiskReason[]): RiskLevel {
  if (reasons.some((r) => r.severity === "block")) return "BLOCK";
  if (score >= 60) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function evaluate(input: SentinelInput): SentinelReport {
  const payer = input.payer.toLowerCase();
  const payee = input.payee.toLowerCase();
  const reasons: RiskReason[] = [];
  const add = (r: RiskReason) => reasons.push(r);
  let lookalikeOf: string | null = null;
  let priorPayments = 0;

  if (payer === payee) add({ code: "SELF_PAYMENT", severity: "info", points: 0, detail: "Payer and payee are the same address." });

  // --- GoPlus ---
  const goplusFlags: string[] = [];
  if (!input.goplus) {
    add({ code: "GOPLUS_UNAVAILABLE", severity: "warn", points: 15, detail: "GoPlus address check unavailable; treat as unverified." });
  } else {
    goplusFlags.push(...input.goplus.blockFlags, ...input.goplus.suspiciousFlags);
    if (input.goplus.blockFlags.length) {
      add({ code: "GOPLUS_MALICIOUS", severity: "block", points: 100, detail: `GoPlus flags payee: ${input.goplus.blockFlags.join(", ")}.` });
    }
    if (input.goplus.suspiciousFlags.length) {
      add({ code: "GOPLUS_SUSPICIOUS", severity: "high", points: 40, detail: `GoPlus suspicious flags: ${input.goplus.suspiciousFlags.join(", ")}.` });
    }
    if (input.goplus.isContract) {
      add({ code: "PAYEE_IS_CONTRACT", severity: "warn", points: 15, detail: "Payee is a contract, not a personal wallet. Unusual for a freelancer invoice." });
    }
  }

  // --- History-based checks ---
  if (!input.outgoing || !input.incoming) {
    add({ code: "HISTORY_UNAVAILABLE", severity: "warn", points: 15, detail: "Could not read payer history from Alchemy; new-payee and lookalike checks skipped." });
  } else {
    const paidTo = new Set(input.outgoing.map((t) => t.to?.toLowerCase()).filter((x): x is string => !!x));
    priorPayments = input.outgoing.filter((t) => t.to?.toLowerCase() === payee).length;

    if (priorPayments > 0) {
      add({ code: "KNOWN_PAYEE", severity: "info", points: 0, detail: `You have paid this address ${priorPayments} time(s) in your recent history.` });
    } else {
      add({ code: "NEW_PAYEE", severity: "warn", points: 20, detail: "You have never paid this address in your recent USDC history." });
      const twin = [...paidTo].find((known) => isLookalike(known, payee));
      if (twin) {
        lookalikeOf = twin;
        add({ code: "LOOKALIKE_ADDRESS", severity: "block", points: 100, detail: `Payee looks like ${twin.slice(0, 6)}…${twin.slice(-4)}, an address you have paid before, but is different. Classic address poisoning.` });
      }
    }

    const dust = input.incoming.filter((t) => t.from.toLowerCase() === payee && (t.value === null || t.value < input.thresholds.dustUsdc));
    if (dust.length && priorPayments === 0) {
      add({ code: "DUST_FROM_PAYEE", severity: "high", points: 40, detail: `Payee sent you ${dust.length} tiny/zero-value transfer(s) and you never paid it. Common poisoning bait.` });
    }

    const pastAmounts = input.outgoing.map((t) => t.value).filter((v): v is number => typeof v === "number" && v > 0);
    const med = pastAmounts.length >= 3 ? median(pastAmounts) : null;
    if (input.usdcAmount > input.thresholds.largeAbsUsdc) {
      add({ code: "VERY_LARGE_AMOUNT", severity: "high", points: 40, detail: `Amount exceeds ${input.thresholds.largeAbsUsdc} USDC.` });
    } else if (med !== null && input.usdcAmount > med * input.thresholds.largeMedianMultiple) {
      add({ code: "LARGE_AMOUNT", severity: "warn", points: 25, detail: `Amount is more than ${input.thresholds.largeMedianMultiple}x your median USDC payment (${med.toFixed(2)}).` });
    }
  }

  const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
  return {
    level: levelFor(score, reasons),
    score,
    reasons,
    priorPaymentsToPayee: priorPayments,
    lookalikeOf: lookalikeOf ? (`0x${lookalikeOf.slice(2)}`) : null,
    goplusFlags,
    historyChecked: (input.outgoing?.length ?? 0) + (input.incoming?.length ?? 0),
    checkedAt: (input.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}
