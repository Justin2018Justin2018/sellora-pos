// Shared CORS headers for Sellora POS edge functions.
// mpesa-stkpush is called directly from the browser (via supabase.functions.invoke),
// so it needs CORS. mpesa-callback is called server-to-server by Safaricom and
// never runs in a browser, but we return the same headers harmlessly.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
