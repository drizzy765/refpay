# RefPay: AI invoice payments with the reference on-chain

**PayBox plugin · MoonPay Hackathons Chapter 1 · Theme: Merchant tools**

Freelancers paid in USDC lose hours proving *which* invoice a payment was for, because a plain USDC transfer carries no reference. And when the payee address arrives in a WhatsApp message, one poisoned lookalike address can drain the whole invoice.

RefPay lets an agent take a messy invoice ("₦50k for the logo, INV-0042, send to 0xabc…"), and:

1. **`parse_invoice`** pulls out payee, amount, currency and reference (Groq LLM, regex fallback).
2. **`quote_invoice`** converts NGN / USD / GHS / KES to exact USDC with live Coinbase rates, cross-checked against open.er-api.com.
3. **`check_payee`** runs the **Sentinel checks**: new vs known payee, address-poisoning lookalikes, dust bait, unusually large amount, and GoPlus malicious-address flags. It returns LOW / MEDIUM / HIGH / BLOCK with reasons.
4. **`pay_invoice`** proposes one Base USDC transfer with the **invoice reference embedded in the transaction data**. It refuses BLOCK and needs explicit acknowledgement for HIGH. PayBox shows the transaction and the user approves with their passkey.
5. **`verify_invoice_paid`** (optional) finds the on-chain payment by its reference.

The plugin never signs or holds keys. It returns an unsigned proposal, and PayBox handles wallet selection, approval, signing and broadcast.

## Quickstart

Requirements: macOS / Linux / WSL2, **Node.js 24** (24.21.0 pinned in CI), **pnpm 11.11.0**.

```bash
pnpm install --frozen-lockfile
pnpm test        # typecheck + 2 deterministic builds + PayBox conformance (sample: quote_invoice)
pnpm unit        # unit tests for memo encoding, rates math, Sentinel rules, invoice parsing
pnpm dev         # run the MCP server over stdio for a local MCP host
```

Upload **only** `dist/plugin.mjs` in the [developer portal](https://developer.paybox.sh). Network hosts and secrets are listed in [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-network-hosts-secrets-and-variables).

## Status of this skeleton

| Piece | State |
|---|---|
| Starter tooling (PayBox starter 1.0.2), `src/paybox.ts` | Unmodified |
| `viem@2.51.3` (exact, as the guide specifies) | Added |
| `lib/rates.ts`, `lib/decimal.ts`, `quote_invoice` | **Implemented**, live-tested |
| `lib/memo.ts` (reference in calldata) | **Implemented**, and USDC on Base accepts the appended bytes (eth_call returned `true`) |
| `lib/risk.ts` Sentinel rule engine (pure) | **Implemented**, unit-tested |
| `lib/sentinel.ts`, `check_payee`, `pay_invoice` | Wired end to end. Data adapters are TODO, so risk degrades to MEDIUM until they're done |
| `parse_invoice` | Wired with regex fallback. Groq call is TODO |
| `lib/alchemy.ts`, `lib/goplus.ts`, `lib/groq.ts` | **TODO stubs** with exact request specs |
| `verify_invoice_paid` | TODO stub (optional, do last) |
| `contracts/MemoProxy.sol` | Fallback only. Do not deploy unless needed |

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md): components, tool schemas, data flow, hosts, secrets, risk rules, fallback
- [AGENT.md](./AGENT.md): instructions for the AI coding agent (read first if you are one)
- [EXECUTION_PLAN.md](./EXECUTION_PLAN.md): hour-by-hour plan to Saturday noon WAT + submission checklist
- [DEMO.md](./DEMO.md): 60-second X video script and tweet copy
- [docs/paybox-requirements.md](./docs/paybox-requirements.md): saved copy of the official PayBox plugin developer guide (source of truth)

## Deadlines

- Hackathon window: Fri Oct 16, 8:00 AM to Sat Oct 17, 8:00 PM New York time (EDT)
- **Hard close: Sun Oct 18, 1:00 AM WAT** (Sat 5:00 PM PT). After that you can't upload or submit.
- Target: **submitted by Sat Oct 17, 12:00 noon WAT**
