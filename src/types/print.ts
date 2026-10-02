/**
 * Cyber Print Monitor types. Shapes mirror the Supabase tables created by
 * supabase-schema-v4-cyber-print-monitor.sql (snake_case on purpose).
 * Cyber-only: nothing here is used by Shop / Gas / Electronics.
 */
export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'failed' | 'cancelled';
export type PrintColorMode = 'bw' | 'color' | 'unknown';
export type PrinterState = 'ready' | 'printing' | 'offline' | 'error' | 'paper_out' | 'unknown';
export type PrintBillingState = 'unbilled' | 'billing' | 'billed';

export interface PrintJob {
  id: string;
  shop_id: string;
  business_type: 'cyber';
  job_hash: string;
  source: 'agent' | 'manual';
  computer_id: string | null;
  printer_id: string | null;
  windows_user: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  document_name: string | null;
  file_type: string | null;
  pages: number | null;
  copies: number | null;
  color_mode: PrintColorMode;
  paper_size: string | null;
  status: PrintJobStatus;
  completion_evidence: string | null;
  error_message: string | null;
  cancel_requested: boolean;
  detected_at: string;
  started_at: string | null;
  completed_at: string | null;
  service_name: string | null;
  rate: number | null;
  amount: number | null;
  billing_state: PrintBillingState;
  tx_receipt: string | null;
  billed_at: string | null;
  operator: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrintPrinter {
  id: string;
  shop_id: string;
  name: string;
  friendly_name: string | null;
  connection: string;
  status: PrinterState;
  status_detail: string | null;
  queue_length: number | null;
  last_seen: string | null;
}

export interface PrintComputer {
  id: string;
  shop_id: string;
  name: string;
  ip: string | null;
  key_hint: string | null;
  monitoring_enabled: boolean;
  current_user_name: string | null;
  last_seen: string | null;
}

export interface PrintPriceRule {
  id: string;
  shop_id: string;
  label: string;
  color_mode: 'bw' | 'color';
  paper_size: string;
  service_name: string | null;
  price_per_page: number | null;
  active: boolean;
}

export interface PrintSettings {
  shop_id: string;
  enabled: boolean;
  auto_billing: boolean;
  retention_days: number;
}

export const PRINT_COMPUTER_COLUMNS =
  'id,shop_id,business_type,name,ip,key_hint,monitoring_enabled,current_user_name,last_seen,created_at';

/** An agent heartbeat older than this is treated as "no live status" -> shown as Status unavailable. */
export const PRINT_STALE_SECONDS = 120;
