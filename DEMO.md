# DEMO: 60-second X video

**Goal:** in one minute, show a judge a real problem (freelancers can't match USDC payments to invoices, and one poisoned address loses the money), the agent doing real work, PayBox's human approval, and the reference sitting on-chain.

Record at 1080p. Put large captions on every scene, because most viewers watch muted. Keep the terminal and chat font at 18pt or bigger.

## Demo invoice (paste this exact text)

> Hi boss 👋 invoice INV-2026-0042 for the logo + brand kit. ₦1,500 pls (test run 😅).
> Pay to my Base USDC wallet: `0x<YOUR SECOND WALLET>`
> Thanks — Tunde Designs

Use ₦1,500 (about 1.13 USDC) so the real payment is cheap. Say "₦1,500 test invoice" out loud. Don't fake a bigger number.

## Shot list

| Time | Screen | Caption / voice-over |
|---|---|---|
| **0–8 s** | Phone: WhatsApp chat with the invoice message above | "Lagos freelancers get paid in USDC. But a USDC transfer has no invoice number, and a fake lookalike address can steal the whole payment." |
| **8–15 s** | Agent chat (Claude/Grok connected to PayBox). Type: *"Pay this invoice from my PayBox wallet and check the address is safe."* + paste | "I just ask my agent." |
| **15–25 s** | Tool calls appear: `parse_invoice` → payee, ₦1,500, ref INV-2026-0042. Then `quote_invoice` → 1.13 USDC at live rate, cross-checked | "RefPay reads the invoice and converts naira to USDC at the live rate, cross-checked against a second source." |
| **25–33 s** | `check_payee` → **Sentinel: LOW. Known payee, no GoPlus flags** | "Sentinel checks the payee against my own history and known scam lists." |
| **33–40 s** | *(Quick cut)* Same flow with a poisoned lookalike address → **BLOCK: looks like 0xabcd…1234 you paid before** and no proposal | "If it's a lookalike poisoning address, RefPay refuses to propose the payment at all." |
| **40–50 s** | `pay_invoice` → PayBox transaction window → **phone passkey / Face ID approval** | "For the real one, RefPay proposes the transfer. PayBox asks me to approve with my passkey, and the agent never touches my keys." |
| **50–60 s** | Basescan tx page → USDC transfer → Input Data → **View Input As UTF-8**, then zoom on `INV-2026-0042` | "And the invoice number is on-chain forever. Paid, matched, done. RefPay, built on PayBox." |

### Recording notes
- Record the BLOCK clip separately. Use a payee that shares the first 4 and last 4 hex characters with an address you've paid (unit test `poisoned twin is BLOCK` shows the rule). The easiest way is to call `check_payee` from the portal Test console with a crafted lookalike. No funds move.
- **Be accurate.** The PayBox window shows the raw transaction (USDC contract, value 0, calldata), not a decoded "1.13 USDC" summary. Don't caption it as "PayBox verified 1.13 USDC". Say "PayBox shows the transaction and asks me to approve."
- Hide API keys, the portal Secrets page, and your email. Showing the public wallet address is fine.
- If Groq is down during recording, the regex fallback still parses this exact invoice.
- If you're on Fallback A (MemoProxy), the last shot is Basescan **Logs → PaymentMemo** event instead of Input Data.

## Tweet copy

**Main post (attach the video):**
> Freelancers in Lagos get paid in USDC, but a USDC transfer has no invoice number, and one poisoned lookalike address can wipe out the payment.
>
> I built **RefPay** for @moonpay's PayBox hackathon 🧾⚡
>
> → AI reads a messy WhatsApp invoice
> → live ₦→USDC quote
> → Sentinel checks catch address poisoning
> → you approve with your passkey in PayBox
> → the invoice reference is written on-chain on Base
>
> #MoonPayHackathons #PayBox

**Reply (thread):**
> How it works: RefPay is a PayBox plugin with 5 MCP tools: parse_invoice, quote_invoice, check_payee, pay_invoice, verify_invoice_paid.
> It never holds keys. It returns an unsigned USDC transfer with the reference in the calldata, and PayBox handles approval and signing.
> Sentinel = transparent rules (lookalike, dust bait, new payee, unusual amount, GoPlus flags), not a black box.

Before posting, check the official MoonPay / PayBox X handle and any required hashtag on the hackathon page, and swap them in. I couldn't confirm either one, so `@moonpay` and the hashtags above are placeholders.
