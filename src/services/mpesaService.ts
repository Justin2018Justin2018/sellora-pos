import { getSupabase, isSupabaseConfigured } from './supabase';

export interface StkPushInitResult {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  error?: string;
}

export type StkFinalStatus = 'success' | 'failed' | 'cancelled' | 'timeout';

export interface StkStatusResult {
  status: StkFinalStatus;
  mpesaReceipt?: string;
  resultDesc?: string;
}

/** Whether real M-Pesa STK Push is even possible right now - it requires cloud sync. */
export const isMpesaAvailable = (): boolean => isSupabaseConfigured();

/**
 * Normalizes a Kenyan phone number to Safaricom's 2547XXXXXXXX / 2541XXXXXXXX
 * format. Returns null if the input doesn't look like a valid Safaricom number.
 */
export function normalizePhone(input: string): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^[17]\d{8}$/.test(digits)) return '254' + digits;
  return null;
}

/**
 * Sends an STK Push prompt to the customer's phone via the mpesa-stkpush
 * edge function. Resolves as soon as Safaricom has accepted the request -
 * NOT once the customer has paid. Use pollStkStatus() afterwards to wait
 * for the actual result.
 */
export async function initiateStkPush(params: {
  shopId: string;
  phone: string;
  amount: number;
  accountReference: string;
  description: string;
}): Promise<StkPushInitResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      error: 'M-Pesa needs cloud sync to work (it needs a server to talk to Safaricom securely). Connect Supabase in Settings first.',
    };
  }

  const normalizedPhone = normalizePhone(params.phone);
  if (!normalizedPhone) {
    return { success: false, error: "Enter a valid Safaricom number, e.g. 0712345678." };
  }

  try {
    const { data, error } = await supabase.functions.invoke('mpesa-stkpush', {
      body: {
        shopId: params.shopId,
        phone: normalizedPhone,
        amount: params.amount,
        accountReference: params.accountReference,
        description: params.description,
      },
    });

    if (error) {
      return { success: false, error: error.message || 'Could not reach M-Pesa. Check your connection and try again.' };
    }
    if (!data?.success) {
      return { success: false, error: data?.error || 'M-Pesa declined the request.' };
    }
    return { success: true, checkoutRequestId: data.checkoutRequestId, merchantRequestId: data.merchantRequestId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not reach M-Pesa.' };
  }
}

/**
 * Polls the mpesa_transactions row for a checkout request until Safaricom's
 * callback has resolved it (success/failed/cancelled) or the timeout is hit.
 * The STK prompt on the customer's phone itself times out after ~60s on
 * Safaricom's side, so a 90s client timeout gives it room to land.
 */
export async function pollStkStatus(
  checkoutRequestId: string,
  opts: { intervalMs?: number; timeoutMs?: number; onTick?: (secondsLeft: number) => void } = {}
): Promise<StkStatusResult> {
  const supabase = getSupabase();
  const interval = opts.intervalMs ?? 3000;
  const timeout = opts.timeoutMs ?? 90000;
  const started = Date.now();

  if (!supabase) {
    return { status: 'failed', resultDesc: 'Supabase is not connected.' };
  }

  while (Date.now() - started < timeout) {
    const { data, error } = await supabase
      .from('mpesa_transactions')
      .select('status, mpesa_receipt, result_desc')
      .eq('checkout_request_id', checkoutRequestId)
      .maybeSingle();

    if (!error && data && data.status && data.status !== 'pending') {
      return {
        status: data.status as StkFinalStatus,
        mpesaReceipt: data.mpesa_receipt || undefined,
        resultDesc: data.result_desc || undefined,
      };
    }

    opts.onTick?.(Math.max(0, Math.round((timeout - (Date.now() - started)) / 1000)));
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return { status: 'timeout', resultDesc: "No response from the customer's phone within the expected time." };
}
