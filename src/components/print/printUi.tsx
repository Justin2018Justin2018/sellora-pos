import React from 'react';
import { PrintJob, PrinterState } from '../../types/print';

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
export const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
export const isSameDay = (iso: string, d: Date) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
};
export const dayStart = (offsetDays = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDays); return d; };

const JOB_STYLE: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  printing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  cancelled: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};
export const needsConfirmation = (j: PrintJob) => j.status === 'printing' && j.completion_evidence === 'queue_exit_unconfirmed';

export const JobBadge: React.FC<{ job: PrintJob }> = ({ job }) => {
  const label = needsConfirmation(job) ? 'Left queue – confirm'
    : job.cancel_requested && (job.status === 'queued' || job.status === 'printing') ? 'Cancelling…'
    : job.status.charAt(0).toUpperCase() + job.status.slice(1);
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${needsConfirmation(job) ? JOB_STYLE.queued : JOB_STYLE[job.status]}`} title={job.error_message || job.completion_evidence || ''}>{label}</span>;
};

const PR_STYLE: Record<PrinterState, string> = {
  ready: 'bg-emerald-100 text-emerald-700', printing: 'bg-blue-100 text-blue-700', offline: 'bg-slate-200 text-slate-700',
  error: 'bg-rose-100 text-rose-700', paper_out: 'bg-amber-100 text-amber-800', unknown: 'bg-slate-100 text-slate-500',
};
const PR_LABEL: Record<PrinterState, string> = { ready: 'READY', printing: 'PRINTING', offline: 'OFFLINE', error: 'ERROR', paper_out: 'PAPER OUT', unknown: 'STATUS UNAVAILABLE' };
/** state === null means no fresh agent report: show "Status unavailable", never a guess. */
export const PrinterBadge: React.FC<{ state: PrinterState | null }> = ({ state }) => {
  const s = state || 'unknown';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${PR_STYLE[s]}`}>{PR_LABEL[s]}</span>;
};

export const Card: React.FC<{ title?: string; children: React.ReactNode; right?: React.ReactNode }> = ({ title, children, right }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
    {(title || right) && <div className="flex items-center justify-between mb-3"><h3 className="font-extrabold text-slate-800 dark:text-white text-sm">{title}</h3>{right}</div>}
    {children}
  </div>
);
export const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
    <p className="text-[11px] uppercase font-bold text-slate-400">{label}</p>
    <p className={`text-xl font-black ${tone || 'text-slate-800 dark:text-white'}`}>{value}</p>
  </div>
);
export const Th: React.FC<{ children?: React.ReactNode }> = ({ children }) => <th className="text-left text-[11px] uppercase font-bold text-slate-400 px-2 py-2 whitespace-nowrap">{children}</th>;
export const Td: React.FC<{ children?: React.ReactNode; cls?: string }> = ({ children, cls }) => <td className={`px-2 py-2 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap ${cls || ''}`}>{children}</td>;
export const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40';
export const btnPrimary = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40';
export const btnDanger = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40';
export const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';

export function downloadText(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
export const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
