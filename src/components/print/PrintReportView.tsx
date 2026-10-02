import React, { useMemo, useState } from 'react';
import { usePrintData } from './usePrintData';
import { Card, Stat, Th, Td, btnPrimary, inputCls } from './printUi';
import * as svc from '../../services/printService';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export const PrintReportView: React.FC = () => {
  const d = usePrintData();
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(new Date()));
  const jobs = useMemo(() => d.jobs.filter((j) => {
    const t = new Date(j.detected_at);
    return t >= new Date(from + 'T00:00:00') && t <= new Date(to + 'T23:59:59');
  }), [d.jobs, from, to]);
  const r = useMemo(() => svc.buildReport(jobs), [jobs]);
  if (!d.allowed) return <Card title="Print Report"><p className="text-sm text-slate-500">{d.blockedReason}</p></Card>;

  const byKey = (key: (j: typeof jobs[number]) => string) => {
    const m = new Map<string, typeof jobs>();
    jobs.forEach((j) => { const k = key(j); m.set(k, [...(m.get(k) || []), j]); });
    return [...m.entries()].map(([k, js]) => ({ k, ...svc.buildReport(js) })).sort((a, b) => b.revenue - a.revenue);
  };
  const byPrinter = byKey((j) => { const p = d.printers.find((x) => x.id === j.printer_id); return p ? (p.friendly_name || p.name) : 'Unknown printer'; });
  const byComputer = byKey((j) => d.computers.find((c) => c.id === j.computer_id)?.name || 'Unknown / manual');

  const printIt = () => {
    const w = window.open('', '_blank'); if (!w) return alert('Allow pop-ups to print the report.');
    const row = (a: string, b: string | number) => `<tr><td>${esc(a)}</td><td style="text-align:right">${esc(b)}</td></tr>`;
    const grp = (title: string, rows: typeof byPrinter) => `<h3>${title}</h3><table><tr><th>Name</th><th>Jobs</th><th>Pages</th><th>Failed</th><th>Revenue</th></tr>${rows.map((x) => `<tr><td>${esc(x.k)}</td><td>${x.totalJobs}</td><td>${x.totalPages}</td><td>${x.failed}</td><td style="text-align:right">${esc(d.formatMoney(x.revenue))}</td></tr>`).join('')}</table>`;
    w.document.write(`<!doctype html><html><head><title>Cyber Print Report</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#172033}h1{text-align:center;margin:0}p.s{text-align:center;color:#555}table{width:100%;border-collapse:collapse;margin:8px 0 16px}td,th{border:1px solid #ddd;padding:6px 8px;font-size:13px;text-align:left}th{background:#f3f5f9}</style></head><body>
      <h1>Cyber Print Report</h1><p class="s">${esc(from)} to ${esc(to)} · generated ${esc(new Date().toLocaleString())}</p>
      <table>${row('Total print jobs', r.totalJobs)}${row('Total pages (completed)', r.totalPages)}${row('Total copies (completed)', r.totalCopies)}${row('Successful prints', r.successful)}${row('Failed prints', r.failed)}${row('Cancelled', r.cancelled)}${row('Print revenue (billed)', d.formatMoney(r.revenue))}${row('B&W revenue', d.formatMoney(r.bwRevenue))}${row('Colour revenue', d.formatMoney(r.colorRevenue))}${row('Completed pages not yet billed', r.unbilledPages)}</table>
      ${grp('By printer', byPrinter)}${grp('By computer', byComputer)}
      <script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <Card title="Print Report" right={<button className={btnPrimary} onClick={printIt}>🖨️ PRINT</button>}>
        <div className="flex gap-2 items-center flex-wrap"><label className="text-xs">From <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="text-xs">To <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label></div>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <Stat label="Total print jobs" value={r.totalJobs} /><Stat label="Total pages" value={r.totalPages} /><Stat label="Total copies" value={r.totalCopies} />
        <Stat label="Successful" value={r.successful} tone="text-emerald-600" /><Stat label="Failed" value={r.failed} tone={r.failed ? 'text-rose-600' : undefined} />
        <Stat label="Print revenue" value={d.formatMoney(r.revenue)} tone="text-emerald-600" /><Stat label="B&W revenue" value={d.formatMoney(r.bwRevenue)} /><Stat label="Colour revenue" value={d.formatMoney(r.colorRevenue)} />
        <Stat label="Cancelled" value={r.cancelled} /><Stat label="Unbilled pages" value={r.unbilledPages} tone={r.unbilledPages ? 'text-amber-600' : undefined} />
      </div>
      {[['By printer', byPrinter], ['By computer', byComputer]].map(([t, rows]) => (
        <Card key={t as string} title={t as string}><table className="w-full"><thead><tr><Th>Name</Th><Th>Jobs</Th><Th>Pages</Th><Th>Failed</Th><Th>Revenue</Th></tr></thead>
          <tbody>{(rows as typeof byPrinter).length === 0 && <tr><Td cls="text-slate-400">No data in this range.</Td></tr>}
            {(rows as typeof byPrinter).map((x) => <tr key={x.k} className="border-t border-slate-100 dark:border-slate-800"><Td>{x.k}</Td><Td>{x.totalJobs}</Td><Td>{x.totalPages}</Td><Td>{x.failed}</Td><Td>{d.formatMoney(x.revenue)}</Td></tr>)}</tbody></table></Card>))}
      <p className="text-[11px] text-slate-400">Pages/copies count completed jobs only. Revenue is the billed amount from Cyber sales; unbilled completed pages are shown separately, never guessed into revenue.</p>
    </div>);
};
