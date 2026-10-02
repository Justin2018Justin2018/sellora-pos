import React, { useState } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, Monitor } from 'lucide-react';
import { usePrintData } from './usePrintData';
import * as svc from '../../services/printService';
import { PrintJob, PrintPriceRule } from '../../types/print';
import { Card, Stat, Th, Td, JobBadge, PrinterBadge, btn, btnPrimary, btnDanger, inputCls, fmtTime, isSameDay, needsConfirmation, downloadText } from './printUi';
import { usePOS } from '../../context/POSContext';

type Sub = 'live' | 'printers' | 'computers' | 'pricing';

export const PrintMonitorView: React.FC = () => {
  const d = usePrintData();
  const { addToast } = usePOS();
  const [sub, setSub] = useState<Sub>('live');
  const [busy, setBusy] = useState<string>('');
  const now = Date.now();

  if (!d.allowed) {
    return <Card title="Print Monitor"><p className="text-sm text-slate-500">{d.blockedReason || 'Not available.'}</p></Card>;
  }
  const serverMode = Boolean(d.shopId && d.serverConfigured);
  const pcName = (id: string | null) => d.computers.find((c) => c.id === id)?.name || '—';
  const prName = (id: string | null) => { const p = d.printers.find((x) => x.id === id); return p ? (p.friendly_name || p.name) : '—'; };
  const today = new Date();
  const todayJobs = d.jobs.filter((j) => isSameDay(j.detected_at, today));
  const rep = svc.buildReport(todayJobs);

  const act = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) addToast({ type: 'success', title: ok }); await d.refresh(); }
    catch (e: any) { addToast({ type: 'error', title: 'Action failed', message: e?.message || String(e) }); }
    finally { setBusy(''); }
  };
  const needOnline = (job: PrintJob) => {
    if (!d.online) { addToast({ type: 'warning', title: 'Internet required', message: 'Changing a server-side print job needs a connection.' }); return false; }
    return true;
  };
  const estimate = (j: PrintJob) => {
    const p = svc.billablePages(j); const pr = svc.resolvePrice(j, d.rules, d.services);
    return p && pr ? p * pr.rate : null;
  };

  const liveJobs = d.jobs.filter((j) => j.status === 'queued' || j.status === 'printing' || isSameDay(j.detected_at, today)).slice(0, 200);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {([['live', 'Live Monitor'], ['printers', 'Printers'], ['computers', 'Cyber Computers'], ['pricing', 'Pricing & Settings']] as [Sub, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setSub(k)} className={sub === k ? btnPrimary : btn}>{l}</button>
          ))}
        </div>
        <button className={btn} onClick={() => d.refresh()}><RefreshCw className={`inline w-3 h-3 mr-1 ${d.loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>

      {!d.online && <div className="flex gap-2 items-start text-xs p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900"><WifiOff className="w-4 h-4 shrink-0" /><span>Offline. You can still log prints and bill them locally; they sync automatically when the internet returns. Live printer status and agent-detected jobs only update while online.</span></div>}
      {!serverMode && <div className="text-xs p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Not connected to a Cyber business on the server. Print Monitor is running in <b>this-device-only</b> mode: you can log and bill prints, but the Windows agent, printers and shared history need the Supabase connection.</div>}
      {d.error && <div className="flex gap-2 items-start text-xs p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Could not load print data from the server: <b>{d.error}</b>. If it mentions a missing table, run <code>supabase-schema-v4-cyber-print-monitor.sql</code> once.</span></div>}

      {sub === 'live' && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Stat label="Jobs today" value={rep.totalJobs} />
          <Stat label="Pages printed today" value={rep.totalPages} />
          <Stat label="Print revenue today" value={d.formatMoney(rep.revenue)} tone="text-emerald-600" />
          <Stat label="Unbilled pages" value={rep.unbilledPages} tone={rep.unbilledPages ? 'text-amber-600' : undefined} />
          <Stat label="Failed today" value={rep.failed} tone={rep.failed ? 'text-rose-600' : undefined} />
          <Stat label="Cancelled today" value={rep.cancelled} />
        </div>

        <Card title="Printers">
          {d.printers.length === 0 ? <p className="text-sm text-slate-500">No printers yet. They appear automatically once a Windows Print Agent reports in (or add one under Printers).</p> : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {d.printers.map((p) => {
                const st = svc.printerLiveState(p, now);
                return (
                  <div key={p.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2"><b className="text-sm truncate">{p.friendly_name || p.name}</b><PrinterBadge state={st} /></div>
                    <p className="text-[11px] text-slate-500 mt-1">Queue: {st && p.queue_length != null ? p.queue_length : 'unavailable'} · {p.connection}</p>
                    <p className="text-[11px] text-slate-400">{p.last_seen ? `Last report ${fmtTime(p.last_seen)}` : 'Never reported by an agent'}{st && p.status_detail ? ` · ${p.status_detail}` : ''}</p>
                  </div>);
              })}
            </div>)}
        </Card>

        <Card title="Print Monitor" right={<ManualLog d={d} />}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Computer</Th><Th>Customer</Th><Th>Document</Th><Th>Pages</Th><Th>Copies</Th><Th>Colour</Th><Th>Printer</Th><Th>Amount</Th><Th>Status</Th><Th>Time</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {liveJobs.length === 0 && <tr><Td cls="text-center text-slate-400" >No print activity yet today.</Td></tr>}
                {liveJobs.map((j) => {
                  const est = estimate(j);
                  const k = j.id;
                  return (
                    <tr key={j.id} className="border-t border-slate-100 dark:border-slate-800">
                      <Td>{j.source === 'agent' ? pcName(j.computer_id) : <span title="Logged manually">✍️ {pcName(j.computer_id)}</span>}</Td>
                      <Td>{j.customer_name || (j.windows_user ? `(${j.windows_user})` : 'Walk-in')}</Td>
                      <Td cls="max-w-[220px] truncate">{j.document_name || '—'}{j.file_type ? <span className="text-slate-400"> .{j.file_type}</span> : null}</Td>
                      <Td>{j.pages ?? '—'}</Td><Td>{j.copies ?? '—'}</Td>
                      <Td>{j.color_mode === 'unknown' ? '—' : j.color_mode === 'bw' ? 'B&W' : 'Colour'}</Td>
                      <Td>{prName(j.printer_id)}</Td>
                      <Td>{j.billing_state === 'billed' ? d.formatMoney(j.amount || 0) : est != null ? <i className="text-slate-400" title="Estimate - not billed yet">~{d.formatMoney(est)}</i> : '—'}</Td>
                      <Td><JobBadge job={j} /></Td>
                      <Td>{fmtTime(j.detected_at)}</Td>
                      <Td>
                        <div className="flex gap-1">
                          {j.status === 'completed' && j.billing_state === 'unbilled' && <button className={btnPrimary} disabled={busy === k} onClick={() => act(k, async () => { await d.billJob(j); })}>Bill</button>}
                          {j.billing_state === 'billed' && <span className="text-[11px] text-emerald-600 font-bold self-center">Billed {j.tx_receipt}</span>}
                          {j.billing_state === 'billing' && d.isOwner && <button className={btn} onClick={() => confirm('Release only if you checked Recent Transactions and this job was NOT charged. Release?') && act(k, () => svc.releaseBilling(j.id))}>Release</button>}
                          {needsConfirmation(j) && (<>
                            <button className={btnPrimary} onClick={() => needOnline(j) && act(k, () => svc.setJobStatus(j, 'completed', 'operator'), 'Marked printed')}>Paper came out</button>
                            <button className={btnDanger} onClick={() => needOnline(j) && act(k, () => svc.setJobStatus(j, 'failed', 'operator', 'Operator: nothing printed'))}>Failed</button></>)}
                          {(j.status === 'queued' || j.status === 'printing') && !needsConfirmation(j) && (
                            <button className={btn} disabled={j.cancel_requested} onClick={() => needOnline(j) && act(k, () => j.source === 'agent' ? svc.requestCancel(j) : svc.setJobStatus(j, 'cancelled'), j.source === 'agent' ? 'Cancel requested – the agent will cancel it on that PC' : 'Cancelled')}>Cancel</button>)}
                        </div>
                      </Td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">“Completed” is only set when the Windows agent saw the pages print (or you confirmed paper came out). Opening a print dialog never completes a job. Amounts with “~” are estimates until billed.</p>
        </Card>

        <Card title="Cyber computers today">
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><Th>PC</Th><Th>Agent</Th><Th>Windows user</Th><Th>Jobs</Th><Th>Pages</Th><Th>Billed</Th><Th>Unbilled pages</Th></tr></thead>
            <tbody>
              {d.computers.length === 0 && <tr><Td cls="text-slate-400">No computers registered yet (Cyber Computers tab).</Td></tr>}
              {d.computers.map((c) => {
                const r = svc.buildReport(todayJobs.filter((j) => j.computer_id === c.id));
                const on = svc.computerOnline(c, now);
                return <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                  <Td><Monitor className="inline w-3 h-3 mr-1" />{c.name}</Td>
                  <Td>{on ? <span className="text-emerald-600 font-bold">online</span> : <span className="text-slate-400">{c.last_seen ? 'offline' : 'never seen'}</span>}</Td>
                  <Td>{on ? c.current_user_name || '—' : '—'}</Td><Td>{r.totalJobs}</Td><Td>{r.totalPages}</Td><Td>{d.formatMoney(r.revenue)}</Td><Td>{r.unbilledPages}</Td></tr>;
              })}
            </tbody></table></div>
          <p className="text-[11px] text-slate-400 mt-2">Sellora has no PC login/timer sessions, so these are per-day totals per computer. Print charges stay in each job and in Cyber sales history after a customer leaves.</p>
        </Card>
      </>)}

      {sub === 'printers' && <PrintersTab d={d} act={act} />}
      {sub === 'computers' && <ComputersTab d={d} act={act} />}
      {sub === 'pricing' && <PricingTab d={d} act={act} />}
    </div>
  );
};

type D = ReturnType<typeof usePrintData>;
type Act = (key: string, fn: () => Promise<void>, ok?: string) => Promise<void>;

const ManualLog: React.FC<{ d: D }> = ({ d }) => {
  const { addToast } = usePOS();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ customer: '', phone: '', doc: '', pages: 1, copies: 1, color: 'bw' as 'bw' | 'color', paper: 'A4', printer: '', computer: '', status: 'completed' as 'queued' | 'completed' | 'failed' });
  const submit = async () => {
    if (!f.pages || f.pages < 1) return addToast({ type: 'error', title: 'Enter a valid page count' });
    await svc.createManualJob({ shopId: d.localShop, customer: f.customer, phone: f.phone, document: f.doc, pages: f.pages, copies: f.copies || 1, colorMode: f.color, paperSize: f.paper, printerId: f.printer || null, computerId: f.computer || null, operator: d.operator, status: f.status });
    addToast({ type: 'success', title: d.online ? 'Print logged' : 'Print logged offline – will sync automatically' });
    setOpen(false); setF({ ...f, doc: '', customer: '', phone: '', pages: 1, copies: 1 }); await d.refresh();
  };
  return (<>
    <button className={btn} onClick={() => setOpen(!open)}>✍️ Log print manually</button>
    {open && (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 w-full max-w-lg space-y-2" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-extrabold">Log a print the agent can’t see</h3>
          <p className="text-[11px] text-slate-500">Tagged “manual” so it is never confused with agent-detected jobs. Works offline.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Customer<input className={inputCls} value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} placeholder="Walk-in Customer" /></label>
            <label className="text-xs">Phone<input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
            <label className="text-xs col-span-2">Document<input className={inputCls} value={f.doc} onChange={(e) => setF({ ...f, doc: e.target.value })} /></label>
            <label className="text-xs">Pages<input type="number" min={1} className={inputCls} value={f.pages} onChange={(e) => setF({ ...f, pages: Number(e.target.value) })} /></label>
            <label className="text-xs">Copies<input type="number" min={1} className={inputCls} value={f.copies} onChange={(e) => setF({ ...f, copies: Number(e.target.value) })} /></label>
            <label className="text-xs">Colour<select className={inputCls} value={f.color} onChange={(e) => setF({ ...f, color: e.target.value as any })}><option value="bw">Black &amp; white</option><option value="color">Colour</option></select></label>
            <label className="text-xs">Paper<input className={inputCls} value={f.paper} onChange={(e) => setF({ ...f, paper: e.target.value })} /></label>
            <label className="text-xs">Printer<select className={inputCls} value={f.printer} onChange={(e) => setF({ ...f, printer: e.target.value })}><option value="">— none —</option>{d.printers.map((p) => <option key={p.id} value={p.id}>{p.friendly_name || p.name}</option>)}</select></label>
            <label className="text-xs">Computer<select className={inputCls} value={f.computer} onChange={(e) => setF({ ...f, computer: e.target.value })}><option value="">— none —</option>{d.computers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="text-xs col-span-2">Outcome<select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as any })}><option value="completed">Completed (paper came out)</option><option value="failed">Failed</option><option value="queued">Queued</option></select></label>
          </div>
          <div className="flex justify-end gap-2 pt-1"><button className={btn} onClick={() => setOpen(false)}>Close</button><button className={btnPrimary} onClick={submit}>Save</button></div>
        </div>
      </div>)}
  </>);
};

const PrintersTab: React.FC<{ d: D; act: Act }> = ({ d, act }) => {
  const [name, setName] = useState(''); const [friendly, setFriendly] = useState(''); const [conn, setConn] = useState('unknown');
  const now = Date.now();
  return (
    <div className="space-y-4">
      <Card title="Register a printer (optional)">
        <p className="text-xs text-slate-500 mb-2">Printers are created automatically when an agent reports them. Use the exact Windows printer name if you add one by hand.</p>
        <div className="grid md:grid-cols-4 gap-2">
          <input className={inputCls} placeholder="Windows printer name e.g. EPSON L805 Series" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Friendly name" value={friendly} onChange={(e) => setFriendly(e.target.value)} />
          <select className={inputCls} value={conn} onChange={(e) => setConn(e.target.value)}><option value="unknown">Unknown</option><option value="usb">USB</option><option value="network">Network / Wi-Fi</option></select>
          <button className={btnPrimary} disabled={!name.trim() || !d.shopId} onClick={() => act('addp', async () => { await svc.addPrinter(d.shopId!, name, friendly, conn); setName(''); setFriendly(''); }, 'Printer added')}>Add</button>
        </div>
      </Card>
      <Card title="Printers"><div className="overflow-x-auto"><table className="w-full">
        <thead><tr><Th>Printer</Th><Th>Status</Th><Th>Queue</Th><Th>Connection</Th><Th>Pages today</Th><Th>Last report</Th><Th /></tr></thead>
        <tbody>{d.printers.length === 0 && <tr><Td cls="text-slate-400">None yet.</Td></tr>}
          {d.printers.map((p) => {
            const st = svc.printerLiveState(p, now);
            const pg = svc.buildReport(d.jobs.filter((j) => j.printer_id === p.id && isSameDay(j.detected_at, new Date()))).totalPages;
            return <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800"><Td><b>{p.friendly_name || p.name}</b>{p.friendly_name && <span className="text-slate-400"> ({p.name})</span>}</Td><Td><PrinterBadge state={st} /></Td><Td>{st && p.queue_length != null ? p.queue_length : 'unavailable'}</Td><Td>{p.connection}</Td><Td>{pg}</Td><Td>{p.last_seen ? new Date(p.last_seen).toLocaleString() : '—'}</Td>
              <Td>{d.isOwner && <button className={btnDanger} onClick={() => confirm('Remove this printer? Its past jobs are kept.') && act(p.id, () => svc.removePrinter(p.id), 'Printer removed')}>Remove</button>}</Td></tr>;
          })}</tbody></table></div></Card>
    </div>);
};

const ComputersTab: React.FC<{ d: D; act: Act }> = ({ d, act }) => {
  const [name, setName] = useState('');
  const [cfg, setCfg] = useState<{ pc: string; json: string } | null>(null);
  const now = Date.now();
  const makeCfg = (pcName: string, id: string, key: string) => JSON.stringify({
    supabase_url: import.meta.env.VITE_SUPABASE_URL || '', anon_key: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    computer_id: id, security_key: key, printer_filter: [], printer_exclude: [], poll_seconds: 1.0, heartbeat_seconds: 30, trust_queue_exit: false,
  }, null, 2);
  return (
    <div className="space-y-4">
      {!d.isOwner && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-xl p-3">Only the Cyber owner can register computers or issue agent keys.</p>}
      <Card title="Register a Cyber computer">
        <div className="flex gap-2"><input className={inputCls} placeholder="e.g. PC-01" value={name} onChange={(e) => setName(e.target.value)} />
          <button className={btnPrimary} disabled={!name.trim() || !d.isOwner || !d.shopId} onClick={() => act('addpc', async () => { const r = await svc.registerComputer(d.shopId!, name); setCfg({ pc: name, json: makeCfg(name, r.computer_id, r.security_key) }); setName(''); }, 'Computer registered')}>Register</button></div>
        <p className="text-[11px] text-slate-500 mt-2">The agent’s security key is shown <b>once</b> after registering or regenerating. Only a hash is stored, so it can’t be shown again.</p>
      </Card>
      <Card title="Cyber computers"><div className="overflow-x-auto"><table className="w-full">
        <thead><tr><Th>Computer</Th><Th>Agent</Th><Th>IP</Th><Th>Windows user</Th><Th>Last seen</Th><Th>Key</Th><Th>Monitoring</Th><Th /></tr></thead>
        <tbody>{d.computers.length === 0 && <tr><Td cls="text-slate-400">None yet.</Td></tr>}
          {d.computers.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800"><Td><b>{c.name}</b></Td>
              <Td>{svc.computerOnline(c, now) ? <span className="text-emerald-600 font-bold">online</span> : c.last_seen ? 'offline' : 'never seen'}</Td>
              <Td>{c.ip || '—'}</Td><Td>{c.current_user_name || '—'}</Td><Td>{c.last_seen ? new Date(c.last_seen).toLocaleString() : '—'}</Td><Td><code>{c.key_hint}…</code></Td>
              <Td><select className={inputCls} value={c.monitoring_enabled ? 'y' : 'n'} onChange={(e) => act(c.id, () => svc.setMonitoring(c.id, e.target.value === 'y'))}><option value="y">Enabled</option><option value="n">Disabled</option></select></Td>
              <Td><div className="flex gap-1">{d.isOwner && <button className={btn} onClick={() => confirm('Regenerate the key? The agent on this PC stops working until you give it the new config.') && act(c.id, async () => { const r = await svc.regenComputerKey(c.id); setCfg({ pc: c.name, json: makeCfg(c.name, r.computer_id, r.security_key) }); })}>New key</button>}
                {d.isOwner && <button className={btnDanger} onClick={() => confirm('Remove this computer? Its job history is kept.') && act(c.id, () => svc.removeComputer(c.id), 'Computer removed')}>Remove</button>}</div></Td></tr>))}
        </tbody></table></div></Card>
      {cfg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 w-full max-w-xl space-y-2">
            <h3 className="font-extrabold">Agent config for {cfg.pc}</h3>
            <p className="text-xs text-slate-500">Download it and save as <code>config.json</code> next to <code>sellora_print_agent.py</code> on that PC. This key is not shown again. Keep the file private.</p>
            <textarea readOnly className="w-full h-48 font-mono text-[11px] border rounded-lg p-2 dark:bg-slate-950" value={cfg.json} />
            <div className="flex justify-end gap-2"><button className={btnPrimary} onClick={() => downloadText('config.json', cfg.json, 'application/json')}>Download config.json</button><button className={btn} onClick={() => setCfg(null)}>Done</button></div>
          </div></div>)}
    </div>);
};

const PricingTab: React.FC<{ d: D; act: Act }> = ({ d, act }) => {
  const blank = { label: '', color_mode: 'bw' as 'bw' | 'color', paper_size: 'A4', service_name: '', price: '' };
  const [r, setR] = useState(blank);
  const [st, setSt] = useState(d.settings);
  React.useEffect(() => setSt(d.settings), [d.settings.auto_billing, d.settings.enabled, d.settings.retention_days]);
  const save = () => act('rule', async () => {
    if (!r.label.trim()) throw new Error('Give the rule a label.');
    if (!r.service_name && !r.price) throw new Error('Pick a Cyber service or enter a price per page.');
    await svc.saveRule(d.shopId!, { label: r.label, color_mode: r.color_mode, paper_size: r.paper_size.trim() || 'A4', service_name: r.service_name || null, price_per_page: r.service_name ? null : Number(r.price), active: true });
    setR(blank);
  }, 'Price rule saved');
  return (
    <div className="space-y-4">
      <Card title="Print price rules">
        <p className="text-xs text-slate-500 mb-2">A rule maps colour + paper size to a price. Link it to an existing Cyber service (Cyber Services &amp; Rates) so the rate and stock deduction come from that one source, or enter a fixed price per page. Unmatched jobs are never billed on a guess.</p>
        <div className="grid md:grid-cols-6 gap-2 items-end">
          <input className={inputCls} placeholder="Label e.g. B&W A4" value={r.label} onChange={(e) => setR({ ...r, label: e.target.value })} />
          <select className={inputCls} value={r.color_mode} onChange={(e) => setR({ ...r, color_mode: e.target.value as any })}><option value="bw">Black &amp; white</option><option value="color">Colour</option></select>
          <input className={inputCls} placeholder="Paper" value={r.paper_size} onChange={(e) => setR({ ...r, paper_size: e.target.value })} />
          <select className={inputCls} value={r.service_name} onChange={(e) => setR({ ...r, service_name: e.target.value })}><option value="">— fixed price —</option>{d.services.map((s) => <option key={s.name} value={s.name}>{s.name} ({d.formatMoney(s.price)})</option>)}</select>
          <input className={inputCls} type="number" min={0} placeholder="Price/page" disabled={!!r.service_name} value={r.price} onChange={(e) => setR({ ...r, price: e.target.value })} />
          <button className={btnPrimary} disabled={!d.shopId} onClick={save}>Add rule</button>
        </div>
        <table className="w-full mt-3"><thead><tr><Th>Label</Th><Th>Colour</Th><Th>Paper</Th><Th>Source</Th><Th>Rate</Th><Th>Active</Th><Th /></tr></thead>
          <tbody>{d.rules.length === 0 && <tr><Td cls="text-slate-400">No rules yet — jobs can't be billed until you add one.</Td></tr>}
            {d.rules.map((x: PrintPriceRule) => { const s = x.service_name ? d.services.find((q) => q.name === x.service_name) : null;
              return <tr key={x.id} className="border-t border-slate-100 dark:border-slate-800"><Td>{x.label}</Td><Td>{x.color_mode === 'bw' ? 'B&W' : 'Colour'}</Td><Td>{x.paper_size}</Td><Td>{x.service_name ? `Service: ${x.service_name}${s ? '' : ' (missing!)'}` : 'Fixed'}</Td><Td>{x.service_name ? (s ? d.formatMoney(s.price) : '—') : d.formatMoney(x.price_per_page || 0)}</Td>
                <Td><input type="checkbox" checked={x.active} onChange={(e) => act(x.id, () => svc.saveRule(d.shopId!, { ...x, active: e.target.checked }))} /></Td>
                <Td><button className={btnDanger} onClick={() => confirm('Delete this rule?') && act(x.id, () => svc.removeRule(x.id))}>Delete</button></Td></tr>; })}</tbody></table>
      </Card>
      <Card title="Print Monitor settings">
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-xs">Monitoring<select className={inputCls} value={st.enabled ? 'y' : 'n'} onChange={(e) => setSt({ ...st, enabled: e.target.value === 'y' })}><option value="y">ON</option><option value="n">OFF</option></select></label>
          <label className="text-xs">Auto-bill completed agent jobs<select className={inputCls} value={st.auto_billing ? 'y' : 'n'} onChange={(e) => setSt({ ...st, auto_billing: e.target.value === 'y' })}><option value="n">OFF (staff press Bill)</option><option value="y">ON</option></select></label>
          <label className="text-xs">Keep history (days)<input type="number" min={7} className={inputCls} value={st.retention_days} onChange={(e) => setSt({ ...st, retention_days: Number(e.target.value) })} /></label>
        </div>
        <div className="mt-3"><button className={btnPrimary} disabled={!d.isOwner || !d.shopId} onClick={() => act('set', () => svc.saveSettings({ ...st, shop_id: d.shopId! }), 'Settings saved')}>Save settings</button>{!d.isOwner && <span className="text-[11px] text-slate-500 ml-2">Owner only.</span>}</div>
        <p className="text-[11px] text-slate-400 mt-2">Auto-billing runs from an open Sellora screen; the database claim guarantees a job is charged once even with several screens open. History retention is stored but old rows are not purged automatically yet.</p>
      </Card>
    </div>);
};
