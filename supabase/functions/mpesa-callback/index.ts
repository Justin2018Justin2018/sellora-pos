// supabase/functions/mpesa-callback/index.ts
//
// This is the public URL you give Safaricom as CallBackURL. It is called
// server-to-server by Safaricom, not by your app, so it must be deployed
// WITHOUT JWT verification:
//
//   supabase functions deploy mpesa-callback --no-verify-jwt
//
// Safaricom needs a fast 200 response with { ResultCode: 0 } or it will
// retry the callback - so this handler does the minimum: parse, update
// the matching row, acknowledge. It never trusts the payload for
// anything security-sensitive beyond looking up the row by
// CheckoutRequestID, which only this server-held credential pair could
// have generated in the first place.

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  // Always acknowledge, even on unexpected input - Safaricom only wants
  // to know we received it, and will keep retrying an unacked callback.
  const ack = () =>
    new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return ack();

  try {
    const payload = await req.json();
    const stkCallback = payload?.Body?.stkCallback;
    if (!stkCallback) {
      console.error('mpesa-callback: unexpected payload shape', JSON.stringify(payload));
      return ack();
    }

    const checkoutRequestId: string | undefined = stkCallback.CheckoutRequestID;
    const resultCode: number = Number(stkCallback.ResultCode);
    const resultDesc: string = stkCallback.ResultDesc || '';

    if (!checkoutRequestId) return ack();

    let mpesaReceipt: string | null = null;
    let transactionDate: string | null = null;
    let amount: number | null = null;
    let phone: string | null = null;

    if (resultCode === 0 && Array.isArray(stkCallback.CallbackMetadata?.Item)) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'MpesaReceiptNumber': mpesaReceipt = String(item.Value); break;
          case 'TransactionDate': transactionDate = String(item.Value); break;
          case 'Amount': amount = Number(item.Value); break;
          case 'PhoneNumber': phone = String(item.Value); break;
        }
      }
    }

    // ResultCode 0 = success, 1032 = cancelled by user, anything else = failed.
    const status = resultCode === 0 ? 'success' : resultCode === 1032 ? 'cancelled' : 'failed';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Idempotent: if we've already resolved this checkout request (Safaricom
    // can call back more than once), don't overwrite it.
    const { data: existing } = await admin
      .from('mpesa_transactions')
      .select('status')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle();

    if (existing && existing.status !== 'pending') {
      return ack();
    }

    const { error: updateErr } = await admin
      .from('mpesa_transactions')
      .update({
        status,
        result_code: resultCode,
        result_desc: resultDesc,
        mpesa_receipt: mpesaReceipt,
        transaction_date: transactionDate,
        ...(amount ? { amount } : {}),
        ...(phone ? { phone } : {}),
      })
      .eq('checkout_request_id', checkoutRequestId);

    if (updateErr) {
      console.error('mpesa-callback: failed to update transaction', updateErr);
    }

    return ack();
  } catch (err) {
    console.error('mpesa-callback error:', err);
    return ack();
  }
});
