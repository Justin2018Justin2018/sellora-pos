import React, { useMemo, useState } from 'react';
import { usePrintData } from './usePrintData';
import { Card, Th, Td, JobBadge, btn, btnDanger, inputCls, fmtDate, fmtTime, dayStart, downloadText, csvCell } from './printUi';
import * as svc from '../../services/printService';
import { usePOS } from '../../context/POSContext';
import { PrintJob } from '../../types/print';

export const filterHistory = (
  jobs: PrintJob[],
  f: { range: 'today' | 'yesterday' | 'range' | 'all'; from: string; to: string; customer: string; computer: string; printer: string; status: string },
  now = new Date(),
): PrintJob[] => {
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const y0 = new Date(t0); y0.setDate(y0.getDate() - 1);
  const t1 = new Date(t0); t1.setDate(t1.getDate() + 1);
  return jobs.filter((j) => {
    const d = new Date(j.detected_at);
    if (f.range === 'today' && !(d >= t0 && d < t1)) return false;
    if (f.range === 'yesterday' && !(d >= y0 && d < t0)) return false;
    if (f.range === 'range') {
      if (f.from && d < new Date(f.from + 'T00:00:00')) return false;
      if (f.to && d > new Date(f.to + 'T23:59:59')) return false;
    }
    if (f.customer && !(j.customer_name || '').toLowerCase().includes(f.customer.toLowerCase())) return false;
    if (f.computer && j.computer_id !== f.computer) return false;
    if (f.printer && j.printer_id !== f.printer) return false;
    if (f.status ? j.status !== f.status : !['completed', 'failed', 'cancelled'].includes(j.status)) return false;
    return true;
  });
};

export const PrintHistoryView: React.FC = () => {
  const d = usePrintData();
  const { addToast } = usePOS();
  const [f, setF] = useState({ range: 'today' as 'today' | 'yesterday' | 'range' | 'all', from: '', to: '', customer: '', computer: '', printer: '', status: '' });
  const rows = useMemo(() => filterHistory(d.jobs, f), [d.jobs, f]);
  if (!d.allowed) return <Card title="Print History"><p className="text-sm text-slate-500">{d.blockedReason}</p></Card>;
  const pc = (id: string | null) => d.computers.find((c) => c.id === id)?.name || '—';
  const pr = (id: string | null) => { const p = d.printers.find((x) => x.id === id); return p ? (p.friendly_name || p.name) : '—'; };
  const exportCsv = () => {
    const head = ['Date', 'Time', 'Customer', 'Computer', 'Document', 'Pages', 'Copies', 'Colour', 'Printer', 'Amount', 'Status', 'Source', 'Receipt'];
    const lines = [head.join(',')].concat(rows.map((j) => [fmtDate(j.detected_at), fmtTime(j.detected_at), j.customer_name || 'Walk-in', pc(j.computer_id), j.document_name, j.pages, j.copies, j.color_mode, pr(j.printer_id), j.amount ?? '', j.status, j.source, j.tx_receipt].map(csvCell).join(',')));
    downloadText(`print-history-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
  };
  const del = async (j: PrintJob) => {
    if (!confirm(`Permanently delete this print record?${j.billing_state === 'billed' ? '\n\nIt was billed. The sale itself is NOT deleted.' : ''}`)) return;
    try { await svc.deleteJob(j); await d.refresh(); } catch (e: any) { addToast({ type: 'error', title: 'Could not delete', message: e?.message || String(e) }); }
  };
  return (
    <div className="space-y-4">
      <Card title="Print History" right={<button className={btn} onClick={exportCsv}>Export CSV</button>}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <select className={inputCls} value={f.range} onChange={(e) => setF({ ...f, range: e.target.value as any })}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="range">Date range</option><option value="all">All time</option></select>
          <input type="date" className={inputCls} disabled={f.range !== 'range'} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <input type="date" className={inputCls} disabled={f.range !== 'range'} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <input className={inputCls} placeholder="Customer" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
          <select className={inputCls} value={f.computer} onChange={(e) => setF({ ...f, computer: e.target.value })}><option value="">All computers</option>{d.computers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className={inputCls} value={f.printer} onChange={(e) => setF({ ...f, printer: e.target.value })}><option value="">All printers</option>{d.printers.map((p) => <option key={p.id} value={p.id}>{p.friendly_name || p.name}</option>)}</select>
          <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Completed / Failed / Cancelled</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="queued">Queued</option><option value="printing">Printing</option></select>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr><Th>Date</Th><Th>Time</Th><Th>Customer</Th><Th>Computer</Th><Th>Document</Th><Th>Pages</Th><Th>Copies</Th><Th>Printer</Th><Th>Amount</Th><Th>Status</Th><Th>Source</Th><Th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><Td cls="text-center text-slate-400">No print jobs match.</Td></tr>}
            {rows.map((j) => (
              <tr key={j.id} className="border-t border-slate-100 dark:border-slate-800">
                <Td>{fmtDate(j.detected_at)}</Td><Td>{fmtTime(j.detected_at)}</Td><Td>{j.customer_name || 'Walk-in'}</Td><Td>{pc(j.computer_id)}</Td>
                <Td cls="max-w-[220px] truncate">{j.document_name || '—'}</Td><Td>{j.pages ?? '—'}</Td><Td>{j.copies ?? '—'}</Td><Td>{pr(j.printer_id)}</Td>
                <Td>{j.billing_state === 'billed' ? d.formatMoney(j.amount || 0) : <span className="text-slate-400">unbilled</span>}</Td>
                <Td><JobBadge job={j} />{j.error_message && <span className="block text-[10px] text-rose-600 max-w-[200px] truncate" title={j.error_message}>{j.error_message}</span>}</Td>
                <Td>{j.source}</Td>
                <Td>{d.isOwner && j.source && <button className={btnDanger} onClick={() => del(j)}>Delete</button>}</Td>
              </tr>))}
          </tbody></table></div>
        <p className="text-[11px] text-slate-400 mt-2">{rows.length} job(s). Dates use this device’s local time.</p>
      </Card>
    </div>);
};
