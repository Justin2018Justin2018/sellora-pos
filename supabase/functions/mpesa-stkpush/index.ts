// supabase/functions/mpesa-stkpush/index.ts
//
// Called from the browser via supabase.functions.invoke('mpesa-stkpush', ...).
// Supabase verifies the caller's JWT before this code runs (deploy WITHOUT
// --no-verify-jwt for this function). We additionally check the caller is
// actually a member of the shop they're claiming to bill for.
//
// Request body: { shopId, phone, amount, accountReference, description }
// Response:     { success: true, checkoutRequestId, merchantRequestId }
//            or { success: false, error }

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { loadMpesaEnvConfig, getAccessToken, baseUrl, daraTimestamp, daraPassword, normalizeKenyanPhone } from '../_shared/mpesa.ts';

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Identify the caller from their JWT (Supabase already validated it).
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return json({ success: false, error: 'Not authenticated.' }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { shopId, phone, amount, accountReference, description } = body || {};

    if (!shopId || !phone || !amount) {
      return json({ success: false, error: 'shopId, phone and amount are required.' }, 400);
    }
    const numericAmount = Math.round(Number(amount));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return json({ success: false, error: 'Amount must be a positive number.' }, 400);
    }
    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!normalizedPhone) {
      return json({ success: false, error: 'Enter a valid Safaricom number, e.g. 0712345678.' }, 400);
    }

    // Confirm the caller belongs to this shop - stops one shop from
    // triggering (and being billed for confusion around) another's payment.
    const { data: membership, error: memberErr } = await admin
      .from('shop_members')
      .select('shop_id')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (memberErr || !membership) {
      return json({ success: false, error: 'You do not have access to this shop.' }, 403);
    }

    const cfg = loadMpesaEnvConfig();
    const token = await getAccessToken(cfg);
    const timestamp = daraTimestamp();
    const password = daraPassword(cfg.shortcode, cfg.passkey, timestamp);

    const stkRes = await fetch(`${baseUrl(cfg.env)}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: cfg.transactionType,
        Amount: numericAmount,
        PartyA: normalizedPhone,
        PartyB: cfg.partyB,
        PhoneNumber: normalizedPhone,
        CallBackURL: cfg.callbackUrl,
        AccountReference: String(accountReference || 'Sellora POS').slice(0, 12),
        TransactionDesc: String(description || 'POS Sale').slice(0, 13),
      }),
    });

    const stkData = await stkRes.json().catch(() => ({}));

    if (!stkRes.ok || stkData.ResponseCode !== '0') {
      const errorMsg = stkData.errorMessage || stkData.ResponseDescription || stkData.CustomerMessage || 'Safaricom rejected the request.';
      return json({ success: false, error: errorMsg }, 200);
    }

    const checkoutRequestId = stkData.CheckoutRequestID;
    const merchantRequestId = stkData.MerchantRequestID;

    const { error: insertErr } = await admin.from('mpesa_transactions').insert({
      shop_id: shopId,
      checkout_request_id: checkoutRequestId,
      merchant_request_id: merchantRequestId,
      phone: normalizedPhone,
      amount: numericAmount,
      account_reference: accountReference || null,
      description: description || null,
      status: 'pending',
      initiated_by: userId,
    });
    if (insertErr) {
      console.error('Failed to record pending mpesa_transactions row:', insertErr);
      // The STK push was already sent to the customer's phone - don't fail
      // the request over a logging error, but surface it for visibility.
    }

    return json({ success: true, checkoutRequestId, merchantRequestId }, 200);
  } catch (err) {
    console.error('mpesa-stkpush error:', err);
    return json({ success: false, error: err instanceof Error ? err.message : 'Unexpected server error.' }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
