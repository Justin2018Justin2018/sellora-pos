# M-Pesa (Daraja) Setup Guide

This wires real Safaricom M-Pesa STK Push into Sellora POS, replacing the old
fake `simulateStkPush()`. Read this once before you deploy — a couple of the
steps below can't be skipped or the feature will silently fail.

## Important: your sandbox credentials won't work in production

You mentioned you have **sandbox** Daraja credentials but want to launch
with **production** payments. These are not interchangeable:

- **Sandbox** credentials only work against `sandbox.safaricom.co.ke`, use
  Safaricom's shared test shortcode (`174379`), and only "pay" fake test
  money — nothing a real customer sends will ever show up.
- **Production** credentials are issued only after Safaricom approves a
  **Go-Live** application tied to your *actual* Till Number, through the
  [Daraja portal](https://developer.safaricom.co.ke). This involves:
  1. Creating a production app on the Daraja portal (separate from your
     sandbox app) → gives you a production Consumer Key/Secret.
  2. Requesting your **Lipa Na M-Pesa Online Passkey** for STK Push, tied
     to your specific Till/Paybill — Safaricom emails this after approving
     the Go-Live request. This is *not* the same passkey as the sandbox one.
  3. Confirming with Safaricom (or your bank, if the till was issued
     through one) which **shortcode** your STK password should be built
     from. For many Buy-Goods tills, the STK Push API authenticates using
     the **head-office Paybill number** linked to the till, not the till
     number itself — the till number is only used as `PartyB` in the
     request. This trips a lot of people up; ask Safaricom support to
     confirm both numbers for your till specifically.

**Recommended path:** deploy and fully test everything below against
sandbox first (instructions cover this). Once it works end-to-end, swap
only the `MPESA_*` secrets for your production values — no code changes
needed.

## What you need before you start

- The [Supabase CLI](https://supabase.com/docs/guides/cli) installed and
  logged in (`supabase login`)
- Your project already linked: `supabase link --project-ref <your-project-ref>`
- Consumer Key, Consumer Secret, and Passkey (sandbox to start)

## 1. Run the database migration

In the Supabase SQL Editor, run `supabase-schema-v6-mpesa-transactions.sql`
(after the v1–v3 migrations already listed in the README, and v4/v5 if
you've applied those). This creates the `mpesa_transactions` table that
the edge functions use to hand off the payment result to the app.

## 2. Deploy the two edge functions

```bash
supabase functions deploy mpesa-stkpush
supabase functions deploy mpesa-callback --no-verify-jwt
```

`mpesa-callback` **must** be deployed with `--no-verify-jwt` — Safaricom
calls it directly and has no Supabase login, so JWT verification would
block every callback and every payment would appear to hang forever.
`mpesa-stkpush` should keep JWT verification on (the default) since it's
only ever called by your logged-in staff from inside the app.

After deploying, copy the callback function's URL — it looks like:
```
https://<project-ref>.supabase.co/functions/v1/mpesa-callback
```
You'll need this in step 3 and step 4.

## 3. Set your secrets

Never put these in `.env`, the app's Settings screen, or anywhere that
ships to the browser — they live only here:

```bash
supabase secrets set MPESA_ENV=sandbox
supabase secrets set MPESA_CONSUMER_KEY=your_consumer_key
supabase secrets set MPESA_CONSUMER_SECRET=your_consumer_secret
supabase secrets set MPESA_PASSKEY=your_passkey
supabase secrets set MPESA_SHORTCODE=174379
supabase secrets set MPESA_TILL_OR_PAYBILL=174379
supabase secrets set MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline
supabase secrets set MPESA_CALLBACK_URL=https://<project-ref>.supabase.co/functions/v1/mpesa-callback
```

Notes on each value:
- `MPESA_SHORTCODE` — the number your STK **password** is built from (see
  the till-vs-paybill note above). For sandbox testing, use Safaricom's
  shared test shortcode `174379`.
- `MPESA_TILL_OR_PAYBILL` — the number that appears as `PartyB` — what the
  customer is actually paying. For sandbox, also `174379`.
- `MPESA_TRANSACTION_TYPE` — `CustomerBuyGoodsOnline` for a Till Number
  (your case), `CustomerPayBillOnline` for a Paybill with account number.

When you move to production, re-run these same commands with your
production values — that's the only change needed.

## 4. Register the callback URL with Safaricom (production only)

For sandbox testing this isn't required — Safaricom's test environment
calls back any valid HTTPS URL you supply in the request itself, which the
`mpesa-stkpush` function already does automatically via `MPESA_CALLBACK_URL`.

For **production**, Safaricom additionally requires you to register your
confirmation/validation URLs against your shortcode once, via the Daraja
portal or a one-time `registerurl` API call, before callbacks are delivered
reliably. Follow the "Go-Live" checklist Safaricom sends you — it will
reference this same callback URL.

## 5. Test it

1. Open the app → make a sale → select **M-Pesa** as the payment method.
   If you see an amber "Not Connected" badge instead of green "Ready",
   Supabase isn't connected (Settings → Cloud Sync) — STK Push needs it.
2. Enter a test phone number and click **Send STK Prompt**.
   - Sandbox: use Safaricom's test MSISDN `254708374149` — it auto-approves,
     no real phone needed.
   - Production: use a real Safaricom number; the customer enters their PIN.
3. Watch the button switch to "Waiting for customer to enter PIN (Ns)".
   On success it fills in the M-Pesa Confirmation Code field and shows a
   toast with the receipt number.

If nothing happens after ~90 seconds, check:
- `supabase functions logs mpesa-stkpush` — auth/config errors show here
- `supabase functions logs mpesa-callback` — confirms whether Safaricom's
  callback ever arrived at all (if not, double check `MPESA_CALLBACK_URL`
  and that the function was deployed with `--no-verify-jwt`)
- The `mpesa_transactions` table directly in the Supabase Table Editor —
  a row stuck on `status = 'pending'` means the callback never landed;
  any other status means it did, and the frontend should have picked it up

## Fallback: no cloud sync, or STK Push fails

The M-Pesa payment method still works without any of the above — staff can
select M-Pesa, ask the customer to pay directly to the till, and type the
M-Pesa confirmation code (the one from the SMS, e.g. `NLJ7X8Y2ZQ`) into the
**M-Pesa Confirmation Code** field manually before completing the sale.
This is unchanged from a normal till payment workflow and needs no backend.

## What changed in the code

- `supabase/functions/mpesa-stkpush/` — initiates the real STK push
- `supabase/functions/mpesa-callback/` — receives Safaricom's result
- `supabase-schema-v6-mpesa-transactions.sql` — new table + RLS
- `src/services/mpesaService.ts` — frontend calls into the above
- `src/context/POSContext.tsx` — `simulateStkPush` → `triggerMpesaStkPush`
  (real implementation, same call shape)
- `src/components/pos/SaleView.tsx` — real wait/timeout UI, manual M-Pesa
  code fallback field, "Not Connected" state when Supabase isn't set up
- `src/types/pos.ts` — `MpesaConfig` no longer holds secret fields; they
  were previously stored in `localStorage` in plain text, which is a
  security bug this fixes
