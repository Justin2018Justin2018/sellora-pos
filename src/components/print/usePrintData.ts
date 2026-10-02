import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../services/supabase';
import { getCurrentConnectivity, startConnectivityMonitor } from '../../services/connectivity';
import * as svc from '../../services/printService';
import { PrintJob } from '../../types/print';
import { ServiceLineItem } from '../../types/pos';

/**
 * Cyber-only gate. The REAL boundary is Postgres RLS (is_cyber_member); this only avoids showing UI that the
 * database would refuse. A shop whose saas_tenants.business_type is not 'cyber' is never allowed here.
 */
export function usePrintAccess() {
  const { businessMode } = usePOS();
  const { memberships, shopId, role, configured } = useAuth();
  const membership = memberships.find((m) => m.shopId === shopId);
  const serverIsCyber = membership ? membership.businessType === 'cyber' : null; // null = no server membership (local-only mode)
  const allowed = businessMode === 'cyber' && serverIsCyber !== false;
  return {
    allowed,
    shopId: membership ? shopId : null,       // null -> not connected to a server shop: jobs stay on this device
    isOwner: role === 'owner',
    serverConfigured: Boolean(configured && isSupabaseConfigured()),
    blockedReason: businessMode !== 'cyber'
      ? 'Print Monitor is only available in the Cyber business.'
      : serverIsCyber === false ? 'This subscription is not a Cyber business, so the database does not allow print data.' : '',
  };
}

export function usePrintData() {
  const access = usePrintAccess();
  const { allowed, shopId } = access;
  const { services, stock, stockRemaining, recordCyberSale, formatMoney, addToast, currentUser, profile, taxRules } = usePOS();
  const [snap, setSnap] = useState<svc.PrintSnapshot | null>(null);
  const [local, setLocal] = useState<{ job: PrintJob; syncStatus: string }[]>([]);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(getCurrentConnectivity() !== 'offline');
  const [loading, setLoading] = useState(false);
  const busy = useRef(new Set<string>());
  const localShop = shopId || 'local';

  useEffect(() => startConnectivityMonitor((s) => setOnline(s !== 'offline')), []);

  const refresh = useCallback(async () => {
    if (!allowed) return;
    try { setLocal(await svc.getLocalJobs(localShop)); } catch { /* indexeddb unavailable */ }
    if (!shopId || !access.serverConfigured) return;
    setLoading(true);
    try {
      const s = await svc.fetchPrintData(shopId);
      setSnap(s); setError('');
    } catch (e: any) {
      const cached = svc.loadSnapshot(shopId);
      if (cached) setSnap(cached);
      setError(e?.message || String(e));
    } finally { setLoading(false); }
  }, [allowed, shopId, localShop, access.serverConfigured]);

  useEffect(() => {
    if (!allowed) return;
    const cached = shopId ? svc.loadSnapshot(shopId) : null;
    if (cached) setSnap(cached);
    void refresh();
    const t = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(t);
  }, [allowed, shopId, refresh]);

  // when connectivity returns, refresh immediately (the sync engine pushes queued jobs on its own)
  useEffect(() => { if (online) void refresh(); }, [online, refresh]);

  const jobs = useMemo(() => svc.mergeJobs(snap?.jobs || [], local), [snap, local]);
  const printers = snap?.printers || [];
  const computers = snap?.computers || [];
  const rules = snap?.rules || [];
  const settings = snap?.settings || svc.DEFAULT_PRINT_SETTINGS(localShop);
  const operator = currentUser?.name || 'Administrator';

  /**
   * Bills a COMPLETED job through the existing Cyber sale path (recordCyberSale) - no second billing system.
   * Server-known jobs first win a database claim (print_claim_billing) so two devices can never both charge.
   */
  const billJob = useCallback(async (job: PrintJob): Promise<boolean> => {
    if (busy.current.has(job.id)) return false;
    busy.current.add(job.id);
    let claimed = false;
    try {
      if (job.status !== 'completed') throw new Error('Only completed prints can be billed.');
      if (job.billing_state !== 'unbilled') throw new Error('This job is already billed (or being billed).');
      const pages = svc.billablePages(job);
      if (!pages) throw new Error('Page count is unknown for this job. Fix the page count before billing.');
      const price = svc.resolvePrice(job, rules, services);
      if (!price) throw new Error('No active price rule matches this job (colour/paper size). Add one under Pricing & Settings.');

      const srv = price.serviceName ? services.find((s) => s.name === price.serviceName) : undefined;
      let stockUsed: { name: string; qty: number } | null = null;
      if (srv && srv.deductStock && srv.stockItem) {
        const need = (Number(srv.stockQty) || 1) * pages;
        const item = stock.find((s) => s.name.toUpperCase() === srv.stockItem!.trim().toUpperCase());
        if (!item) throw new Error(`Stock item "${srv.stockItem}" does not exist in inventory.`);
        if (stockRemaining(item) < need) throw new Error(`Not enough ${item.name}: need ${need}, have ${stockRemaining(item)}.`);
        stockUsed = { name: srv.stockItem, qty: need };
      }

      const localOnly = await svc.isLocalOnly(job.id);
      if (!localOnly) {
        if (!online) throw new Error('This job lives on the server; billing it needs an internet connection so two devices cannot charge it twice.');
        if (!(await svc.claimBilling(job.id))) throw new Error('Another device is billing (or already billed) this job.');
        claimed = true;
      }

      const material = Number(srv?.material || 0);
      const total = price.rate * pages;
      const rule = (taxRules || []).find((r) => r.isDefault && r.active) || (taxRules || [])[0];
      const taxOn = Boolean(profile.enableTax && rule && rule.rate > 0);
      const taxRate = taxOn && rule ? rule.rate : 0;
      const taxMode = rule ? rule.type : (profile.taxCalculationMode || 'inclusive');
      const taxAmount = !taxOn ? 0 : taxMode === 'exclusive' ? total * taxRate / 100 : total - total / (1 + taxRate / 100);
      const grand = taxOn && taxMode === 'exclusive' ? total + taxAmount : total;
      const label = price.serviceName || price.ruleLabel;
      const line: ServiceLineItem = { service: label, qty: pages, price: price.rate, material, total, materialTotal: material * pages, stockUsed };

      const tx = recordCyberSale({
        customer: job.customer_name || 'Walk-in Customer', phone: job.customer_phone || '', service: `${label} × ${pages}`,
        services: [line], qty: pages, price: total, subtotal: total, total: grand,
        material: material * pages, materialTotal: material * pages, taxRate, taxAmount: Number(taxAmount.toFixed(2)), taxMode,
        taxName: rule?.name || profile.taxName || 'VAT', paid: grand, change: 0, profit: grand - material * pages,
        payment: 'Cash', stockUsed: stockUsed ? [stockUsed] : [], notes: `Print job ${job.document_name || job.id.slice(0, 8)}`,
      });

      const stamp = { billing_state: 'billed' as const, tx_receipt: tx.receipt, amount: grand, service_name: label, rate: price.rate, billed_at: new Date().toISOString() };
      if (localOnly) await svc.updateLocalJob(job, stamp);
      else {
        try { await svc.markBilled(job.id, tx.receipt, grand, label, price.rate); }
        catch (e: any) {
          addToast({ type: 'error', title: 'Billed, but job not stamped', message: `Sale ${tx.receipt} WAS recorded. Tell the owner to release this job only after checking Transactions. ${e?.message || ''}` });
        }
      }
      addToast({ type: 'success', title: 'Print billed', message: `${label} × ${pages} = ${formatMoney(grand)} (${tx.receipt})` });
      await refresh();
      return true;
    } catch (e: any) {
      if (claimed) { try { await svc.releaseBilling(job.id); } catch { /* owner can release */ } }
      addToast({ type: 'error', title: 'Could not bill print job', message: e?.message || String(e) });
      return false;
    } finally { busy.current.delete(job.id); }
  }, [rules, services, stock, stockRemaining, recordCyberSale, online, refresh, addToast, formatMoney, taxRules, profile]);

  // Optional auto-billing: bills newly completed, priceable, server-claimed jobs. The DB claim stops double charges.
  const autoDone = useRef(new Set<string>());
  useEffect(() => {
    if (!allowed || !settings.auto_billing || !online) return;
    for (const j of jobs) {
      if (j.status === 'completed' && j.billing_state === 'unbilled' && j.source === 'agent' && !autoDone.current.has(j.id)
          && svc.billablePages(j) && svc.resolvePrice(j, rules, services)) {
        autoDone.current.add(j.id);
        void billJob(j);
      }
    }
  }, [jobs, settings.auto_billing, online, allowed, rules, services, billJob]);

  return { ...access, snap, jobs, printers, computers, rules, settings, error, online, loading, refresh, billJob, operator, services, formatMoney, localShop };
}
