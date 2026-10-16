// Exact decimal helpers using BigInt. Never use floating point for money.

/** Parse a decimal string into { int, scale } so value = int / 10^scale. Truncates beyond maxScale. */
export function toScaled(value: string, maxScale = 18): { int: bigint; scale: number } {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) throw new Error(`Not a decimal: ${value.slice(0, 40)}`);
  const frac = (m[2] ?? "").slice(0, maxScale);
  return { int: BigInt(`${m[1]}${frac}`), scale: frac.length };
}

/** ceil(amount / rate) expressed in atomic units with `decimals` places. */
export function divCeilAtomic(amount: string, rate: string, decimals: number): bigint {
  const a = toScaled(amount);
  const r = toScaled(rate);
  if (r.int === 0n) throw new Error("Rate is zero");
  const num = a.int * 10n ** BigInt(r.scale + decimals);
  const den = r.int * 10n ** BigInt(a.scale);
  return (num + den - 1n) / den;
}

/** Atomic integer -> decimal string with trailing zeros stripped. */
export function formatAtomic(atomic: bigint, decimals: number): string {
  const s = atomic.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
