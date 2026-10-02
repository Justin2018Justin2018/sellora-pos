import { getSupabase, isSupabaseConfigured } from './supabase';
import { offlineDb, getDeviceId } from './offlineDb';
import { enqueueSync, processSyncQueue } from './syncEngine';
import { checkRealConnectivity } from './connectivity';
import {
  PrintJob, PrintPrinter, PrintComputer, PrintPriceRule, PrintSettings,
  PRINT_COMPUTER_COLUMNS, PRINT_STALE_SECONDS, PrinterState,
} from '../types/print';
import { ServiceItem } from '../types/pos';

/**
 * Cyber Print Monitor data layer.
 * - Server truth lives in Supabase (print_* tables, Cyber-only RLS).
 * - Jobs created on THIS device (manual / offline) are written to Dexie first and pushed through the
 *   existing sync queue (entity 'printJob'), idempotent by id -> no duplicates after reconnect.
 * - Jobs detected by the Windows agent go straight agent -> Supabase; this layer only reads them.
 * Nothing here invents data: unknown pages / status stay null / 'unknown'.
 */

const snapKey = (shopId: string) => `sellora_print_snapshot:${shopId}`;

export interface PrintSnapshot {
  printers: PrintPrinter[];
  computers: PrintComputer[];
  jobs: PrintJob[];
  rules: PrintPriceRule[];
  settings: PrintSettings | null;
  fetchedAt: string;
}

export const DEFAULT_PRINT_SETTINGS = (shopId: string): PrintSettings => ({
  shop_id: shopId, enabled: true, auto_billing: false, retention_days: 90,
});

export function loadSnapshot(shopId: string): PrintSnapshot | null {
  try {
    const raw = localStorage.getItem(snapKey(shopId));
    return raw ? (JSON.parse(raw) as PrintSnapshot) : null;
  } catch { return null; }
}

function saveSnapshot(shopId: string, s: PrintSnapshot) {
  try {
    localStorage.setItem(snapKey(shopId), JSON.stringify({ ...s, jobs: s.jobs.slice(0, 500) }));
  } catch { /* quota - snapshot is best-effort */ }
}

/** Fetches live data. Throws on any Supabase error so the UI can show the real message (never hides it). */
export async function fetchPrintData(shopId: string): Promise<PrintSnapshot> {
  const client = getSupabase();
  if (!client || !isSupabaseConfigured()) throw new Error('Supabase is not configured');
  const [p, c, j, r, s] = await Promise.all([
    client.from('print_printers').select('*').eq('shop_id', shopId).order('name'),
    client.from('print_computers').select(PRINT_COMPUTER_COLUMNS).eq('shop_id', shopId).order('name'),
    client.from('print_jobs').select('*').eq('shop_id', shopId).order('detected_at', { ascending: false }).limit(2000),
    client.from('print_price_rules').select('*').eq('shop_id', shopId).order('label'),
    client.from('print_settings').select('*').eq('shop_id', shopId).maybeSingle(),
  ]);
  const err = p.error || c.error || j.error || r.error || s.error;
  if (err) throw new Error(err.message || String(err));
  const snap: PrintSnapshot = {
    printers: (p.data || []) as PrintPrinter[],
    computers: (c.data || []) as PrintComputer[],
    jobs: (j.data || []) as PrintJob[],
    rules: (r.data || []) as PrintPriceRule[],
    settings: (s.data as PrintSettings) || null,
    fetchedAt: new Date().toISOString(),
  };
  saveSnapshot(shopId, snap);
  return snap;
}

/** Jobs created on this device that the server has not confirmed yet (shown immediately, even offline). */
export async function getLocalJobs(shopId: string): Promise<{ job: PrintJob; syncStatus: string }[]> {
  const rows = await offlineDb.printJobs.where('shopId').equals(shopId).toArray();
  return rows.map((r) => ({ job: r.payload as unknown as PrintJob, syncStatus: r.syncStatus }));
}

/** Server rows + local rows, local wins for the same id (it is the newer edit until synced). */
export function mergeJobs(server: PrintJob[], local: { job: PrintJob; syncStatus: string }[]): PrintJob[] {
  const map = new Map<string, PrintJob>();
  server.forEach((j) => map.set(j.id, j));
  local.forEach(({ job, syncStatus }) => { if (syncStatus !== 'synced' || !map.has(job.id)) map.set(job.id, job); });
  return [...map.values()].sort((a, b) => (b.detected_at || '').localeCompare(a.detected_at || ''));
}

async function pushNow() {
  try { if (await checkRealConnectivity()) await processSyncQueue(); } catch { /* retried by backoff */ }
}

async function saveLocal(job: PrintJob, op: 'CREATE' | 'UPDATE') {
  const now = new Date().toISOString();
  const existing = await offlineDb.printJobs.get(job.id);
  await offlineDb.printJobs.put({
    localId: job.id, shopId: job.shop_id, createdAt: existing?.createdAt || now, updatedAt: now,
    syncStatus: 'pending', deviceId: await getDeviceId(), userId: job.operator || undefined,
    payload: job as unknown as Record<string, unknown>,
  });
  await enqueueSync('printJob', job.id, op);
  void pushNow();
}

export interface ManualJobInput {
  shopId: string; customer: string; phone?: string; document: string; fileType?: string;
  pages: number; copies: number; colorMode: 'bw' | 'color'; paperSize: string;
  printerId?: string | null; computerId?: string | null; operator: string;
  status: 'queued' | 'completed' | 'failed';
}

/** Manual log: for prints the agent can't see. Tagged source:'manual' so it's never confused with agent jobs. Works offline. */
export async function createManualJob(i: ManualJobInput): Promise<PrintJob> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: PrintJob = {
    id, shop_id: i.shopId, business_type: 'cyber', job_hash: `manual:${id}`, source: 'manual',
    computer_id: i.computerId || null, printer_id: i.printerId || null, windows_user: null,
    customer_name: i.customer.trim() || 'Walk-in Customer', customer_phone: i.phone?.trim() || null,
    document_name: i.document.trim() || null, file_type: i.fileType || null,
    pages: i.pages, copies: i.copies, color_mode: i.colorMode, paper_size: i.paperSize,
    status: i.status, completion_evidence: i.status === 'completed' ? 'manual' : null, error_message: null,
    cancel_requested: false, detected_at: now, started_at: null,
    completed_at: i.status === 'queued' ? null : now,
    service_name: null, rate: null, amount: null, billing_state: 'unbilled', tx_receipt: null, billed_at: null,
    operator: i.operator, created_at: now, updated_at: now,
  };
  await saveLocal(job, 'CREATE');
  return job;
}

/** True when this job exists only on this device so far (safe to edit locally without a server claim). */
export async function isLocalOnly(jobId: string): Promise<boolean> {
  const r = await offlineDb.printJobs.get(jobId);
  return !!r && r.syncStatus !== 'synced';
}

export async function updateLocalJob(job: PrintJob, patch: Partial<PrintJob>): Promise<PrintJob> {
  const next = { ...job, ...patch, updated_at: new Date().toISOString() } as PrintJob;
  await saveLocal(next, 'UPDATE');
  return next;
}

/* ---------- staff actions on server-known jobs (online only - stated in the UI) ---------- */
function need() {
  const c = getSupabase();
  if (!c) throw new Error('Supabase is not configured');
  return c;
}
export async function setJobStatus(job: PrintJob, status: 'completed' | 'failed' | 'cancelled', evidence?: string, error?: string) {
  const patch: Record<string, unknown> = { status, completed_at: new Date().toISOString() };
  if (evidence) patch.completion_evidence = evidence;
  if (error) patch.error_message = error;
  const { data, error: e } = await need().from('print_jobs').update(patch).eq('id', job.id).eq('shop_id', job.shop_id).select('id');
  if (e) throw new Error(e.message);
  if (!data || data.length !== 1) throw new Error('The database refused the change (permission).');
}
/** Agent jobs: ask the agent to cancel the spooler job. The record only becomes Cancelled when the agent confirms. */
export async function requestCancel(job: PrintJob) {
  const { data, error: e } = await need().from('print_jobs').update({ cancel_requested: true }).eq('id', job.id).eq('shop_id', job.shop_id).select('id');
  if (e) throw new Error(e.message);
  if (!data || data.length !== 1) throw new Error('The database refused the change (permission).');
}
export async function deleteJob(job: PrintJob) {
  const { data, error: e } = await need().from('print_jobs').delete().eq('id', job.id).eq('shop_id', job.shop_id).select('id');
  if (e) throw new Error(e.message);
  if (!data || data.length !== 1) throw new Error('Only the Cyber owner can delete print records.');
  await offlineDb.printJobs.delete(job.id);
}
export async function setJobCustomer(job: PrintJob, name: string, phone: string) {
  const { error: e } = await need().from('print_jobs').update({ customer_name: name || null, customer_phone: phone || null }).eq('id', job.id).eq('shop_id', job.shop_id);
  if (e) throw new Error(e.message);
}

/* ---------- billing claim (server side, prevents double charge across devices) ---------- */
export async function claimBilling(jobId: string): Promise<boolean> {
  const { data, error } = await need().rpc('print_claim_billing', { p_job_id: jobId });
  if (error) throw new Error(error.message);
  return data === true;
}
export async function markBilled(jobId: string, receipt: string, amount: number, service: string, rate: number) {
  const { error } = await need().rpc('print_mark_billed', { p_job_id: jobId, p_receipt: receipt, p_amount: amount, p_service: service, p_rate: rate });
  if (error) throw new Error(error.message);
}
export async function releaseBilling(jobId: string) {
  const { error } = await need().rpc('print_release_billing', { p_job_id: jobId });
  if (error) throw new Error(error.message);
}

/* ---------- printers / computers / prices / settings ---------- */
export async function addPrinter(shopId: string, name: string, friendly: string, connection: string) {
  const { error } = await need().from('print_printers').insert({ shop_id: shopId, name: name.trim(), friendly_name: friendly.trim() || null, connection });
  if (error) throw new Error(error.message);
}
export async function removePrinter(id: string) {
  const { error } = await need().from('print_printers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function registerComputer(shopId: string, name: string): Promise<{ computer_id: string; security_key: string }> {
  const { data, error } = await need().rpc('print_register_computer', { p_shop_id: shopId, p_name: name });
  if (error) throw new Error(error.message);
  return data as { computer_id: string; security_key: string };
}
export async function regenComputerKey(id: string): Promise<{ computer_id: string; security_key: string }> {
  const { data, error } = await need().rpc('print_regen_key', { p_computer_id: id });
  if (error) throw new Error(error.message);
  return data as { computer_id: string; security_key: string };
}
export async function setMonitoring(id: string, enabled: boolean) {
  const { error } = await need().from('print_computers').update({ monitoring_enabled: enabled }).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function removeComputer(id: string) {
  const { error } = await need().from('print_computers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function saveRule(shopId: string, r: Omit<PrintPriceRule, 'id' | 'shop_id'> & { id?: string }) {
  const row = { shop_id: shopId, label: r.label, color_mode: r.color_mode, paper_size: r.paper_size, service_name: r.service_name, price_per_page: r.price_per_page, active: r.active };
  const q = r.id ? need().from('print_price_rules').update(row).eq('id', r.id) : need().from('print_price_rules').insert(row);
  const { error } = await q;
  if (error) throw new Error(error.message);
}
export async function removeRule(id: string) {
  const { error } = await need().from('print_price_rules').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function saveSettings(s: PrintSettings) {
  const { error } = await need().from('print_settings').upsert({ ...s, updated_at: new Date().toISOString() }, { onConflict: 'shop_id' });
  if (error) throw new Error(error.message);
}

/* ---------- pure helpers (unit-tested) ---------- */
export function isFresh(ts: string | null | undefined, now = Date.now(), secs = PRINT_STALE_SECONDS): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return !isNaN(t) && now - t < secs * 1000;
}

/** Live printer state, or null = "Status unavailable" (no fresh agent report). Never guessed. */
export function printerLiveState(p: PrintPrinter, now = Date.now()): PrinterState | null {
  if (!isFresh(p.last_seen, now)) return null;
  return p.status === 'unknown' ? null : p.status;
}
export function computerOnline(c: PrintComputer, now = Date.now()): boolean { return isFresh(c.last_seen, now); }

export function billablePages(j: Pick<PrintJob, 'pages' | 'copies'>): number | null {
  if (!j.pages || j.pages < 1) return null; // unknown page count is never billed on a guess
  return j.pages * Math.max(1, j.copies || 1);
}

export interface ResolvedPrice { rate: number; serviceName: string | null; ruleLabel: string }
/** Price comes from a rule; a rule linked to a Cyber service takes the rate from that service (single source of truth). */
export function resolvePrice(
  j: Pick<PrintJob, 'color_mode' | 'paper_size'>, rules: PrintPriceRule[], services: ServiceItem[],
): ResolvedPrice | null {
  if (j.color_mode === 'unknown') return null;
  const size = (j.paper_size || 'A4').toUpperCase();
  const cand = rules.filter((r) => r.active && r.color_mode === j.color_mode);
  const rule = cand.find((r) => r.paper_size.toUpperCase() === size) || cand.find((r) => r.paper_size.toUpperCase() === 'A4' && !j.paper_size);
  if (!rule) return null;
  if (rule.service_name) {
    const svc = services.find((s) => s.name === rule.service_name);
    if (!svc) return null;
    return { rate: Number(svc.price) || 0, serviceName: svc.name, ruleLabel: rule.label };
  }
  if (rule.price_per_page == null) return null;
  return { rate: Number(rule.price_per_page), serviceName: null, ruleLabel: rule.label };
}

export interface PrintReport {
  totalJobs: number; totalPages: number; totalCopies: number; successful: number; failed: number; cancelled: number;
  revenue: number; bwRevenue: number; colorRevenue: number; unbilledPages: number;
}
/** Report over a job list. Pages count only for completed jobs; revenue only from billed amounts. */
export function buildReport(jobs: PrintJob[]): PrintReport {
  const r: PrintReport = { totalJobs: jobs.length, totalPages: 0, totalCopies: 0, successful: 0, failed: 0, cancelled: 0, revenue: 0, bwRevenue: 0, colorRevenue: 0, unbilledPages: 0 };
  for (const j of jobs) {
    if (j.status === 'failed') r.failed++;
    if (j.status === 'cancelled') r.cancelled++;
    if (j.status !== 'completed') continue;
    r.successful++;
    const bp = billablePages(j) || 0;
    r.totalPages += bp;
    r.totalCopies += Math.max(1, j.copies || 1);
    if (j.billing_state === 'billed') {
      const a = Number(j.amount || 0);
      r.revenue += a;
      if (j.color_mode === 'color') r.colorRevenue += a; else if (j.color_mode === 'bw') r.bwRevenue += a;
    } else r.unbilledPages += bp;
  }
  return r;
}
