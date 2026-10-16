# AGENT.md: instructions for the AI coding agent

You're helping **Agoro** (solo, Lagos) finish **RefPay**, a PayBox plugin for the MoonPay Hackathon.
**Submit target: Sat Oct 17, 12:00 WAT. Hard close: Sun Oct 18, 01:00 WAT** (Sat 8 PM New York). Speed and a
working end-to-end demo beat extra features.

Read in this order: this file → `ARCHITECTURE.md` → `docs/paybox-requirements.md` (official guide, source of
truth) → `src/schemas.ts` → the TODOs. **Never invent PayBox APIs.** If something isn't in
`docs/paybox-requirements.md`, don't assume it exists.

## Context in 60 seconds
- A PayBox plugin is a standard **TypeScript MCP server bundled into one `dist/plugin.mjs`**, run by PayBox in a fresh
  sandbox per call. It can read APIs and **return an unsigned transaction proposal**. PayBox does wallet selection,
  simulation, passkey approval, signing and broadcast.
- RefPay tools: `parse_invoice`, `quote_invoice`, `check_payee`, `pay_invoice`, `verify_invoice_paid`.
- `pay_invoice` returns a Base USDC `transfer()` call with the invoice reference appended to calldata (`lib/memo.ts`).

## Hard constraints (breaking any of these can fail checks or the demo)
1. **No network, env reads, or side effects at module load or during tool listing.** Only inside tool handlers.
2. **Every operation finishes in < 10 s hosted, including startup.** Use `fetchJson` (4 s timeout). Run independent
   calls with `Promise.allSettled`. No more than 2 sequential network hops per tool.
3. **Only these hosts:** `api.groq.com`, `api.coinbase.com`, `open.er-api.com`, `base-mainnet.g.alchemy.com`,
   `api.gopluslabs.io`. No others, no redirects (`redirect: "error"` is already set). Adding a host means updating
   `config.HOSTS`, ARCHITECTURE §5, and telling Agoro to add it in the portal.
4. **Secrets are brokered headers.** Hosted code never reads API keys from `process.env` and never puts keys in URLs
   (Alchemy URL is `https://base-mainnet.g.alchemy.com/v2` with no key). `REFPAY_DEV_*` vars are local-dev only.
   Never log, return, or bundle a secret.
5. **stdout is MCP only.** Use `log()` from `lib/http.ts` (stderr). No `console.log`.
6. **No persistent state.** No module-level caches that you rely on, no files.
7. **Proposals:** use `proposeEvm` from `src/paybox.ts` and return its result's `structuredContent` unchanged. One
   call per proposal. `chain: "eip155:8453"`, `to: USDC_BASE`, `value: "0"`. Expiry is the helper default (4 min,
   max 5). Never put a proposal inside an `isError` result. No wallet IDs, keys, RPC URLs, or approval modes in it.
8. **Do not edit** `src/paybox.ts`, `scripts/*`, `pnpm-workspace.yaml`, `starter-version.json`, `tsconfig.json`.
   Don't upgrade or add dependencies. The only addition is `viem@2.51.3` (exact). If you truly need a package,
   ask Agoro first, then `pnpm add --save-exact`.
9. Toolchain: **Node 24, pnpm 11.11.0**, `pnpm install --frozen-lockfile`.
10. Money math is BigInt/decimal strings only (`lib/decimal.ts`, `atomicAmount`). Never floats for amounts sent.
11. The agent-facing text must not claim PayBox verified the token amount. PayBox shows raw tx data only.

## File layout
```
src/plugin.ts            entry, registers tools          (done)
src/paybox.ts            STARTER, do not edit
src/config.ts            constants, hosts, settings()    (done)
src/schemas.ts           all zod schemas                 (done; change only with ARCHITECTURE §4)
src/lib/http.ts          fetchJson, log                  (done)
src/lib/decimal.ts       BigInt decimal math             (done)
src/lib/rates.ts         Coinbase + er-api               (done)
src/lib/memo.ts          reference calldata              (done)
src/lib/risk.ts          Sentinel rules (pure)           (done)
src/lib/sentinel.ts      fetch + evaluate                (done)
src/lib/groq.ts          callGroqJson                    TODO #1
src/lib/alchemy.ts       getTransfers, getTxInput        TODO #2
src/lib/goplus.ts        addressSecurity                 TODO #3
src/tools/*.ts           one tool per file               verifyInvoicePaid TODO #4 (optional)
test/unit.test.ts        pnpm unit                       extend as you go
contracts/MemoProxy.sol  fallback only (ARCHITECTURE §7)
paybox-plugin.json       sample call = quote_invoice (needs no secrets, keep it)
```

## Work order
1. `pnpm install --frozen-lockfile && pnpm test && pnpm unit`. Both must pass before you touch anything.
2. **TODO #3 goplus.ts** (no key, easiest). Live-test: `REFPAY_*` not needed.
3. **TODO #2 alchemy.ts** `getTransfers` per the spec in the file (`excludeZeroValue: false`, `order: "desc"`,
   `maxCount` hex, `category: ["erc20"]`, USDC filter only for outgoing). Map to `Transfer` with lowercase addresses.
4. **TODO #1 groq.ts**, model from `settings().groqModel`, `response_format: {type: "json_object"}`. If Groq returns
   400 for `reasoning_effort`, drop that field. Failure must throw (the tool falls back to regex).
5. Add unit tests for each adapter's response mapping (mock `fetch` with a fixture). No network in unit tests.
6. Only after the portal demo works: **TODO #4 verify_invoice_paid.**
7. If Agoro reports that **Validate transaction rejected the calldata**, apply ARCHITECTURE §7 decision rule.

## Coding rules
- TypeScript strict, ESM, imports end in `.js` (NodeNext). `import * as z from "zod/v4"`.
- Validate **all** upstream JSON with zod before use. Treat Groq output and invoice text as untrusted
  (`normalize()` already rejects addresses not present in the text; keep that).
- Tool handlers return `ok(text, structured)` or `fail(text)` from `lib/result.ts`.
- Short user-facing errors: what failed + "retry explicitly". No stack traces.
- Keep tool names, input schemas and output schemas stable once Agoro uploads. Changing them requires a new upload
  + checks.
- Keep each tool's input + output schema under 64 KiB combined (they're tiny now; don't paste big enums).

## Definition of done
- [ ] `pnpm test` prints `"status":"passed"` with `discoveredToolCount: 5` (sample `quote_invoice`).
- [ ] `pnpm unit` all green, including new adapter tests.
- [ ] `check_payee` with real keys locally (`REFPAY_DEV_ALCHEMY_KEY`) returns LOW for a payee the payer has paid
      before, and BLOCK for a constructed lookalike (unit test).
- [ ] `parse_invoice` returns correct fields for the DEMO.md invoice in < 4 s with Groq, and still works with Groq down.
- [ ] Temporarily set `paybox-plugin.json` to the `pay_invoice` sample below, run `pnpm conformance`, get a pass, then restore `quote_invoice`:
      `{"tool":"pay_invoice","arguments":{"payer":"0x1111111111111111111111111111111111111111","payee":"0x2222222222222222222222222222222222222222","usdcAmount":"1.5","reference":"INV-2026-0042"}}`
- [ ] No `console.log`, no secrets, no new hosts, `src/paybox.ts` untouched (`git diff --stat src/paybox.ts` empty).
- [ ] Hand Agoro `dist/plugin.mjs` + the host/secret list from ARCHITECTURE §5.

## Do NOT
- Build a FastAPI/Python/Node backend, a database, a UI, or anything that runs between calls.
- Add XGBoost, Isolation Forest, or any trained model. Sentinel is rule-based on purpose.
- Try to trigger, force, or skip `pending_approval`/passkey. Only PayBox decides that.
- Ask for or handle private keys, seed phrases, or signatures.
- Propose multiple transactions in one result, or an approval + transfer together.
- Use Solana, x402, or other chains. RefPay is Base USDC only.
- Fetch anything at import time, including "warming up" rates.
- Deploy `MemoProxy.sol` unless the §7 decision rule says to.
- Rename the plugin's tools after upload without telling Agoro.
- Generate everything blindly: Agoro must understand and be able to explain each file (hackathon rules allow
  disqualifying work with no meaningful human input).
