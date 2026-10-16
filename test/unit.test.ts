// Unit tests for pure logic. Run: pnpm unit   (not part of `pnpm test`, which is the PayBox conformance gate)
import assert from "node:assert/strict";
import { test } from "node:test";
import { divCeilAtomic, formatAtomic } from "../src/lib/decimal.ts";
import { decodeReferenceFromInput, encodeTransferWithReference } from "../src/lib/memo.ts";
import { evaluate, isLookalike } from "../src/lib/risk.ts";
import { regexExtract, normalize } from "../src/tools/parseInvoice.ts";

const PAYER = "0x1111111111111111111111111111111111111111";
const KNOWN = "0xabcd000000000000000000000000000000001234";
const TWIN = "0xabcdffffffffffffffffffffffffffffffff1234";
const th = { largeAbsUsdc: 1000, largeMedianMultiple: 3, dustUsdc: 0.01 };
const tx = (from: string, to: string, value: number) => ({ from, to, value, token: null, asset: "USDC", hash: "0x", blockNum: 1, timestamp: null });

test("NGN -> USDC rounds up to 6 dp", () => {
  const a = divCeilAtomic("50000", "1331.41584938207744453200694564192096", 6);
  assert.equal(formatAtomic(a, 6), "37.554007");
});

test("memo round-trips and keeps transfer selector", () => {
  const data = encodeTransferWithReference(KNOWN as `0x${string}`, 37_554_009n, "INV-2026-0042");
  assert.ok(data.startsWith("0xa9059cbb"));
  assert.equal((data.length - 2) % 2, 0);
  assert.equal(decodeReferenceFromInput(data), "INV-2026-0042");
});

test("lookalike detection", () => {
  assert.equal(isLookalike(KNOWN, TWIN), true);
  assert.equal(isLookalike(KNOWN, KNOWN), false);
});

test("poisoned twin is BLOCK", () => {
  const r = evaluate({ payer: PAYER, payee: TWIN, usdcAmount: 40, outgoing: [tx(PAYER, KNOWN, 40)], incoming: [tx(TWIN, PAYER, 0)], goplus: { blockFlags: [], suspiciousFlags: [], isContract: false }, thresholds: th });
  assert.equal(r.level, "BLOCK");
  assert.equal(r.lookalikeOf, KNOWN);
});

test("known payee normal amount is LOW", () => {
  const r = evaluate({ payer: PAYER, payee: KNOWN, usdcAmount: 40, outgoing: [tx(PAYER, KNOWN, 40), tx(PAYER, KNOWN, 35), tx(PAYER, KNOWN, 50)], incoming: [], goplus: { blockFlags: [], suspiciousFlags: [], isContract: false }, thresholds: th });
  assert.equal(r.level, "LOW");
});

test("missing data never yields LOW", () => {
  const r = evaluate({ payer: PAYER, payee: KNOWN, usdcAmount: 40, outgoing: null, incoming: null, goplus: null, thresholds: th });
  assert.equal(r.level, "MEDIUM");
});

test("regex fallback parses a WhatsApp invoice", () => {
  const text = "Hi boss, invoice INV-0042 for the logo work. ₦50,000 pls. Base USDC: 0xabcd000000000000000000000000000000001234 thanks";
  const p = normalize(regexExtract(text), text);
  assert.equal(p.amount, "50000");
  assert.equal(p.currency, "NGN");
  assert.equal(p.reference, "INV-0042");
  assert.equal(p.payeeAddress, KNOWN);
});

test("hallucinated address is discarded", () => {
  const p = normalize({ payeeAddress: TWIN, amount: "1", currency: "USD", reference: "X1" }, "pay me 1 usd ref X1");
  assert.equal(p.payeeAddress, null);
});
