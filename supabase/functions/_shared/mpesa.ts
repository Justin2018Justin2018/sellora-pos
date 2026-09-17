// Shared helpers for talking to Safaricom's Daraja API.
//
// All secrets are read from Supabase Edge Function environment variables
// (set with `supabase secrets set ...`) - they never touch the browser.
//
// Required secrets (see MPESA_SETUP.md):
//   MPESA_ENV              "sandbox" | "production"
//   MPESA_CONSUMER_KEY
//   MPESA_CONSUMER_SECRET
//   MPESA_PASSKEY           Lipa Na M-Pesa Online passkey for your shortcode
//   MPESA_SHORTCODE         The shortcode used to build the STK password.
//                           For a Paybill this is your paybill number.
//                           For Buy-Goods/Till, Safaricom's STK Push API
//                           historically required the PAYBILL/head-office
//                           shortcode linked to your till for this value
//                           (not the till number customers see) - confirm
//                           which one your passkey was issued for.
//   MPESA_TILL_OR_PAYBILL   The number customers actually pay to (PartyB).
//                           For Till: your till number. For Paybill: same
//                           as MPESA_SHORTCODE.
//   MPESA_TRANSACTION_TYPE  "CustomerBuyGoodsOnline" | "CustomerPayBillOnline"
//   MPESA_CALLBACK_URL      Public HTTPS URL of the mpesa-callback function,
//                           e.g. https://<project-ref>.supabase.co/functions/v1/mpesa-callback

export interface MpesaEnvConfig {
  env: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  partyB: string;
  transactionType: 'CustomerBuyGoodsOnline' | 'CustomerPayBillOnline';
  callbackUrl: string;
}

export function loadMpesaEnvConfig(): MpesaEnvConfig {
  const env = (Deno.env.get('MPESA_ENV') || 'sandbox').toLowerCase() as 'sandbox' | 'production';
  const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY') || '';
  const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET') || '';
  const passkey = Deno.env.get('MPESA_PASSKEY') || '';
  const shortcode = Deno.env.get('MPESA_SHORTCODE') || '';
  const partyB = Deno.env.get('MPESA_TILL_OR_PAYBILL') || shortcode;
  const transactionType =
    (Deno.env.get('MPESA_TRANSACTION_TYPE') as MpesaEnvConfig['transactionType']) ||
    'CustomerBuyGoodsOnline';
  const callbackUrl = Deno.env.get('MPESA_CALLBACK_URL') || '';

  const missing = Object.entries({ consumerKey, consumerSecret, passkey, shortcode, partyB, callbackUrl })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `M-Pesa is not fully configured on the server. Missing secret(s): ${missing.join(', ')}. ` +
      `Run 'supabase secrets set ...' for each - see MPESA_SETUP.md.`
    );
  }

  return { env, consumerKey, consumerSecret, passkey, shortcode, partyB, transactionType, callbackUrl };
}

export function baseUrl(env: 'sandbox' | 'production'): string {
  return env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

/** OAuth token, cached in memory for the life of the function instance. */
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(cfg: MpesaEnvConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5000) {
    return cachedToken.token;
  }
  const credentials = btoa(`${cfg.consumerKey}:${cfg.consumerSecret}`);
  const res = await fetch(`${baseUrl(cfg.env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Daraja auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const expiresInSec = Number(data.expires_in) || 3600;
  cachedToken = { token: data.access_token, expiresAt: Date.now() + expiresInSec * 1000 };
  return cachedToken.token;
}

/** Timestamp in Safaricom's required YYYYMMDDHHmmss format, Africa/Nairobi (EAT, UTC+3, no DST). */
export function daraTimestamp(): string {
  const nowUtc = new Date();
  const eat = new Date(nowUtc.getTime() + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    eat.getUTCFullYear().toString() +
    pad(eat.getUTCMonth() + 1) +
    pad(eat.getUTCDate()) +
    pad(eat.getUTCHours()) +
    pad(eat.getUTCMinutes()) +
    pad(eat.getUTCSeconds())
  );
}

export function daraPassword(shortcode: string, passkey: string, timestamp: string): string {
  return btoa(`${shortcode}${passkey}${timestamp}`);
}

/** Normalizes a Kenyan phone number to Safaricom's expected 2547XXXXXXXX / 2541XXXXXXXX format. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return '254' + digits;
  return null;
}
