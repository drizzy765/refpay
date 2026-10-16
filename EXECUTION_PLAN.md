# Execution plan: RefPay → submitted by Sat Oct 17, 12:00 WAT

All times **WAT (Lagos)**. Hard close **Sun Oct 18, 01:00 WAT** (= Sat 8:00 PM New York). After that you
can't upload, submit or withdraw. You can still edit hosts and secrets.

Strategy: **get a minimal version uploaded, validated and submitted on Friday night as insurance**, then
improve it and submit newer versions Saturday morning. The guide allows uploading and submitting a new
version any time before the deadline.

---

## Fri 21:00–21:45: Accounts first (these can block everything)
- [ ] Sign up at **https://app.paybox.sh**. Add a passkey, plus a **second passkey on another device** (losing the only passkey locks the account).
- [ ] Start **MoonPay identity verification with the exact same email** as PayBox. The portal unlocks the
      submission workspace only when the emails match.
- [ ] Open **https://developer.paybox.sh**, then **Register with PayBox**. If an eligibility badge shows, finish KYC and click **Recheck**.
      (The developer session lasts up to 3 days.)
- [ ] Create keys (don't paste them anywhere except the portal):
  - Groq: https://console.groq.com, API Keys
  - Alchemy: https://dashboard.alchemy.com, create an app with **Base Mainnet** enabled, then copy the API key
- [ ] Fund your PayBox Base wallet for the demo: **~2 USDC on Base + ~$0.50 of ETH on Base** for gas.
- [ ] Note your PayBox Base wallet's **public address** (you'll pass it as `payer`).
- [ ] Prepare a **payee** address you control (a second wallet), so the demo payment comes back to you.

> If KYC is still pending, keep building locally. Local `pnpm test` doesn't need an account.

## Fri 21:45–22:15: Toolchain and green baseline
```bash
node -v   # v24.x  (nvm install 24.21.0)
corepack enable && corepack prepare pnpm@11.11.0 --activate   # or: npm i -g pnpm@11.11.0
cd refpay
pnpm install --frozen-lockfile
pnpm test     # expect "status":"passed", discoveredToolCount 5
pnpm unit     # 8 passing
```

## Fri 22:15–23:15: ⚠️ CALLDATA TEST (do this early, it decides the architecture)
The current bundle already proposes a payment with the reference appended. Risk shows MEDIUM until the adapters are done, which is fine for this test.
1. Portal → upload `dist/plugin.mjs`.
2. **Test & configure → network hosts:** add all 5 exactly:
   `api.groq.com`, `api.coinbase.com`, `open.er-api.com`, `base-mainnet.g.alchemy.com`, `api.gopluslabs.io`
3. **Variables & Secrets → Secret:**
   - host `api.groq.com`, header `Authorization`, value `Bearer gsk_…`
   - host `base-mainnet.g.alchemy.com`, header `Authorization`, value `Bearer <alchemy key>`
4. Wait 30 s, then **Run checks again** until the checks pass.
5. **Test → Load tools → `quote_invoice`** `{"amount":"1500","currency":"NGN"}`, then **Run test**. You should get about 1.13 USDC.
6. **Test → `pay_invoice`** with your real addresses:
   `{"payer":"<your PayBox Base address>","payee":"<your 2nd wallet>","usdcAmount":"1","reference":"INV-TEST-001"}`
   then **Run test**, then pick your wallet and click **Validate transaction**. You have 5 minutes, and only 30 validations per hour.
7. **Result:**
   - ✅ Preview OK: the primary strategy works. Continue.
   - ❌ Rejected because of calldata: follow ARCHITECTURE §7. Before 03:00 use Fallback A (MemoProxy). Later than that, use Fallback B (plain transfer).
     Tell the coding agent exactly what error the portal showed.
8. **Accept the MoonPay Hackathon Terms and click Submit Project** (insurance entry v1). Uploading alone does NOT enter you.

## Fri 23:15–00:45: Sentinel data (AI agent, AGENT.md TODO #3 then #2)
- [ ] `lib/goplus.ts` addressSecurity, with a unit test using a fixture
- [ ] `lib/alchemy.ts` getTransfers, with a unit test using a fixture
- [ ] Local smoke test with `REFPAY_DEV_ALCHEMY_KEY=… pnpm dev` (or a temporary `paybox-plugin.json` sample for `check_payee`)
- [ ] `pnpm test` and `pnpm unit` both green

## Fri 00:45–01:45: AI parsing (TODO #1)
- [ ] `lib/groq.ts` callGroqJson, tested on the DEMO.md invoice text with `REFPAY_DEV_GROQ_KEY`
- [ ] Confirm the fallback works with the key unset
- [ ] `pnpm test` green → **upload v2 → Run checks → test parse_invoice + check_payee in portal → Submit Project (v2)**

## Fri 01:45–07:00: Sleep. Seriously.

## Sat 07:00–08:30: Real end-to-end through an agent
- [ ] PayBox → **Unofficial plugins** (https://app.paybox.sh/plugins) → enable RefPay
- [ ] Connect your agent (Claude / Grok etc.) to PayBox: MCP `https://api.paybox.sh/mcp`, OAuth, grant your Base wallet
- [ ] In the agent: `discover_plugins` / `get_plugin` (don't guess IDs), then `use_plugin` for each tool, with `wallet_id` on pay_invoice
- [ ] Run the full DEMO.md flow with **1 USDC** to your second wallet, approve with your passkey, poll the request until `success`
- [ ] Open the tx on https://basescan.org → Input Data → **View Input As UTF-8**, confirm `RFP1…INV-2026-0042` is visible
- [ ] Do a dry run of the BLOCK case (lookalike address) so you can show the refusal in the video

## Sat 08:30–10:00: Record demo
- [ ] Follow DEMO.md: screen-record desktop + phone (passkey approval)
- [ ] Edit to ≤ 60 s, add captions (most X videos are watched muted)

## Sat 10:00–11:00: Optional polish (only if everything above is done)
- [ ] TODO #4 verify_invoice_paid → upload v3 → checks → test → **Submit Project (v3)**
- [ ] Otherwise skip it. A working 4-tool plugin beats a broken 5-tool plugin.

## Sat 11:00–11:45: Post on X and final submission check
- [ ] Post the video on X with the DEMO.md tweet copy, then copy the post URL
- [ ] If the portal has a field for the demo link, paste it there

## Sat 11:45–12:00: Submission checklist ✅
- [ ] Latest `dist/plugin.mjs` uploaded, **checks passed**
- [ ] 5 network hosts configured, 2 secrets configured (Groq, Alchemy)
- [ ] Hosted **tool test** passes for quote_invoice, parse_invoice, check_payee, pay_invoice
- [ ] **Validate transaction** preview passes for pay_invoice
- [ ] **Terms accepted + Submit Project clicked for the latest version**
- [ ] Plugin enabled under Unofficial plugins, and an agent call works end to end
- [ ] Demo video **posted on X**
- [ ] Repo is clean: no `.env`, no keys in git history

## Buffer: Sat 12:00 → Sun 01:00 WAT
Use it only for fixes. After 01:00 you can still change hosts and secrets (for example, to rotate a key), but you can't upload.

---

### Limits to remember
- 1 plugin start per second, 1,000 per rolling 24 h (calls + tests + checks share this)
- Validation: 1 active, 30 per hour. Each result can be validated once, within 5 min
- Tool lists in the portal expire after 10 min. **Load tools** again after any upload or settings change
- PayBox never auto-retries. If an outcome is uncertain, check Basescan before running the call again

### If something breaks
| Symptom | Fix |
|---|---|
| `timeout` in checks/tests | an upstream is slow. Make sure calls run in parallel, and the 4 s timeouts stay |
| Tool returns "unavailable" hosted but works locally | missing network host or secret in portal, or a wrong header value (`Bearer ` prefix) |
| Submit button locked | KYC not verified, or PayBox and MoonPay emails differ. Click **Recheck** |
| Validate fails on gas | add more ETH on Base to the wallet |
| Validate fails on calldata | ARCHITECTURE §7 |
