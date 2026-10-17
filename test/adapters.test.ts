// Adapter unit tests: mock global fetch, no network. Verifies the response mapping of
// alchemy.ts, goplus.ts and groq.ts, plus the end-to-end Sentinel outcome (LOW/BLOCK/HIGH).
import assert from "node:assert/strict";
import { test } from "node:test";
import { USDC_BASE } from "../src/config.ts";
import { getTransfers, getTxInput } from "../src/lib/alchemy.ts";
import { addressSecurity } from "../src/lib/goplus.ts";
import { callGroqJson } from "../src/lib/groq.ts";
import { runSentinel } from "../src/lib/sentinel.ts";

const PAYER = "0x1111111111111111111111111111111111111111";
const KNOWN = "0xabcd000000000000000000000000000000001234";
const TWIN = "0xabcdffffffffffffffffffffffffffff1234"; // same first 4 + last 4 as KNOWN
const DUST = "0x9999000000000000000000000000000000009999";
const ALCHEMY_URL = "https://base-mainnet.g.alchemy.com/v2";

type FetchInit = { method?: string; body?: string; headers?: Record<string, string> };

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function withFetch(handler: (url: string, init: FetchInit) => Response | Promise<Response>, fn: () => Promise<void>): Promise<void> {
  const orig = globalThis.fetch;
  globalThis.fetch = ((input: unknown, init?: unknown) => handler(String(input), (init ?? {}) as FetchInit)) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = orig;
  });
}

function alchemyTransfer(overrides: Partial<{ from: string; to: string | null; value: number; hash: string; blockNum: string }> = {}) {
  return {
    blockNum: "0x1a2b3c",
    hash: "0x" + "a".repeat(64),
    from: PAYER,
    to: KNOWN,
    value: 40,
    asset: "USDC",
    category: "erc20",
    rawContract: { value: "0x0", address: USDC_BASE, decimal: "0x6" },
    metadata: { blockTimestamp: "2026-10-16T12:00:00.000Z" },
    ...overrides,
  };
}

function cleanGoPlus() {
  return {
    cybercrime: "0", money_laundering: "0", phishing_activities: "0", stealing_attack: "0", sanctioned: "0",
    blackmail_activities: "0", honeypot_related_address: "0", financial_crime: "0", darkweb_transactions: "0",
    blacklist_doubt: "0", fake_kyc: "0", mixer: "0", malicious_mining_activities: "0", fake_token: "0",
    fake_standard_interface: "0", gas_abuse: "0", reinit: "0", number_of_malicious_contracts_created: "0",
    contract_address: "0", data_source: "",
  };
}

test("getTransfers maps alchemy erc20 transfers to lowercase Transfer", async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, ALCHEMY_URL);
    const body = JSON.parse(init.body!);
    assert.equal(body.method, "alchemy_getAssetTransfers");
    const p = body.params[0];
    assert.equal(p.fromAddress, PAYER);
    assert.deepEqual(p.contractAddresses, [USDC_BASE]);
    assert.equal(p.excludeZeroValue, false);
    assert.equal(p.order, "desc");
    assert.equal(p.maxCount, "0x32"); // historyCount 50
    return jsonRes({ jsonrpc: "2.0", id: 1, result: { transfers: [alchemyTransfer({ to: "0xABCD000000000000000000000000000000001234", blockNum: "0x1a2b3c" })] } });
  }, async () => {
    const t = await getTransfers({ fromAddress: PAYER, usdcOnly: true });
    assert.equal(t.length, 1);
    assert.equal(t[0]!.from, PAYER.toLowerCase());
    assert.equal(t[0]!.to, KNOWN);
    assert.equal(t[0]!.value, 40);
    assert.equal(t[0]!.token, USDC_BASE);
    assert.equal(t[0]!.asset, "USDC");
    assert.equal(t[0]!.blockNum, parseInt("0x1a2b3c", 16));
    assert.equal(t[0]!.timestamp, "2026-10-16T12:00:00.000Z");
  });
});

test("getTxInput returns the transaction input hex", async () => {
  const input = "0xa9059cbb" + "a".repeat(64) + "b".repeat(64);
  await withFetch(async (url, init) => {
    const body = JSON.parse(init.body!);
    assert.equal(body.method, "eth_getTransactionByHash");
    return jsonRes({ jsonrpc: "2.0", id: 1, result: { input } });
  }, async () => {
    assert.equal(await getTxInput("0x" + "c".repeat(64)), input);
  });
});

test("getTxInput returns null for an unknown transaction", async () => {
  await withFetch(() => jsonRes({ jsonrpc: "2.0", id: 1, result: null }), async () => {
    assert.equal(await getTxInput("0x" + "c".repeat(64)), null);
  });
});

test("addressSecurity maps a malicious flag to blockFlags", async () => {
  await withFetch((url) => {
    assert.equal(url, "https://api.gopluslabs.io/api/v1/address_security/" + KNOWN + "?chain_id=8453");
    return jsonRes({ code: 1, message: "ok", result: { ...cleanGoPlus(), cybercrime: "1" } });
  }, async () => {
    const r = await addressSecurity(KNOWN);
    assert.deepEqual(r.blockFlags, ["cybercrime"]);
    assert.deepEqual(r.suspiciousFlags, []);
    assert.equal(r.isContract, false);
  });
});

test("addressSecurity flags contracts and malicious contracts", async () => {
  await withFetch(() => jsonRes({ code: 1, message: "ok", result: { ...cleanGoPlus(), contract_address: "1", number_of_malicious_contracts_created: "2" } }), async () => {
    const r = await addressSecurity(KNOWN);
    assert.equal(r.isContract, true);
    assert.deepEqual(r.suspiciousFlags, ["malicious_contracts"]);
  });
});

test("callGroqJson parses JSON content", async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(init.body!);
    assert.equal(body.model, "openai/gpt-oss-20b");
    assert.deepEqual(body.response_format, { type: "json_object" });
    return jsonRes({ choices: [{ message: { content: JSON.stringify({ payeeAddress: KNOWN, amount: "40", currency: "USD", reference: "INV-1" }) } }] });
  }, async () => {
    const r = await callGroqJson("pay 40 USD to " + KNOWN);
    assert.equal(r.payeeAddress, KNOWN);
    assert.equal(r.amount, "40");
  });
});

test("callGroqJson drops reasoning_effort after a 400", async () => {
  let calls = 0;
  await withFetch(async (url, init) => {
    const body = JSON.parse(init.body!);
    calls += 1;
    if (calls === 1) {
      assert.ok("reasoning_effort" in body, "first call should include reasoning_effort");
      return jsonRes({ error: { message: "reasoning_effort not supported" } }, 400);
    }
    assert.ok(!("reasoning_effort" in body), "retry should omit reasoning_effort");
    return jsonRes({ choices: [{ message: { content: JSON.stringify({ payeeAddress: KNOWN }) } }] });
  }, async () => {
    const r = await callGroqJson("pay " + KNOWN);
    assert.equal(r.payeeAddress, KNOWN);
    assert.equal(calls, 2);
  });
});

test("Sentinel: a known payee scores LOW through the real adapters", async () => {
  await withFetch((url, init) => {
    if (url.startsWith("https://api.gopluslabs.io/")) return jsonRes({ code: 1, message: "ok", result: cleanGoPlus() });
    const body = JSON.parse(init.body!);
    const p = body.params[0];
    const transfers = p.fromAddress
      ? [alchemyTransfer(), alchemyTransfer({ value: 35 }), alchemyTransfer({ value: 50 })]
      : [];
    return jsonRes({ jsonrpc: "2.0", id: 1, result: { transfers } });
  }, async () => {
    const r = await runSentinel(PAYER, KNOWN, "40");
    assert.equal(r.level, "LOW");
    assert.equal(r.priorPaymentsToPayee, 3);
  });
});

test("Sentinel: a lookalike address scores BLOCK through the real adapters", async () => {
  await withFetch((url, init) => {
    if (url.startsWith("https://api.gopluslabs.io/")) return jsonRes({ code: 1, message: "ok", result: cleanGoPlus() });
    const body = JSON.parse(init.body!);
    const p = body.params[0];
    const transfers = p.fromAddress ? [alchemyTransfer()] : [];
    return jsonRes({ jsonrpc: "2.0", id: 1, result: { transfers } });
  }, async () => {
    const r = await runSentinel(PAYER, TWIN, "40");
    assert.equal(r.level, "BLOCK");
    assert.equal(r.lookalikeOf, KNOWN);
  });
});

test("Sentinel: dust bait from a never-paid payee scores HIGH (not LOW)", async () => {
  await withFetch((url, init) => {
    if (url.startsWith("https://api.gopluslabs.io/")) return jsonRes({ code: 1, message: "ok", result: cleanGoPlus() });
    const body = JSON.parse(init.body!);
    const p = body.params[0];
    const transfers = p.fromAddress
      ? []
      : [alchemyTransfer({ from: DUST, to: PAYER, value: 0 })];
    return jsonRes({ jsonrpc: "2.0", id: 1, result: { transfers } });
  }, async () => {
    const r = await runSentinel(PAYER, DUST, "5");
    assert.equal(r.level, "HIGH");
    assert.equal(r.reasons.some((x) => x.code === "DUST_FROM_PAYEE"), true);
  });
});
