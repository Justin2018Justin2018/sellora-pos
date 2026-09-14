import React, { useState, useMemo, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { Transaction, Expense } from '../../types/pos';
import {
  BarChart3,
  Calendar,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  PieChart,
  Boxes,
  Receipt,
  CreditCard,
  Building,
  Trash2,
  Edit2,
  X,
  Search,
  Filter,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Flame,
  Cpu,
  ReceiptText,
  AlertTriangle,
  ChevronDown,
  Layers,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { DeleteTransactionModal, DeletableItemDetails } from '../common/DeleteTransactionModal';
import { executeShiftReportPrint, openShiftReportInNewTab } from '../../utils/printReceipt';

interface ReportsViewProps {
  onOpenReceipt?: (tx: Transaction) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onOpenReceipt }) => {
  const {
    profile,
    businessMode,
    transactions,
    gasTransactions,
    electronicsSales,
    expenses,
    familyExpenses,
    formatMoney,
    updateExpense,
    currentUser,
    addToast,
  } = usePOS();

  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'cyber' | 'gas' | 'electronics' | 'expense' | 'family'>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [itemToDelete, setItemToDelete] = useState<DeletableItemDetails | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [editExpenseCat, setEditExpenseCat] = useState('');
  const [editExpenseAmt, setEditExpenseAmt] = useState(0);
  const [editExpenseDesc, setEditExpenseDesc] = useState('');
  const [editExpensePay, setEditExpensePay] = useState<'M-Pesa' | 'Cash' | 'Bank'>('M-Pesa');
  const [editExpenseDate, setEditExpenseDate] = useState('');
  const ledgerTableRef = useRef<HTMLDivElement>(null);

  const openExpenseEditor = (exp: Expense) => {
    setExpenseToEdit(exp);
    setEditExpenseCat(exp.category);
    setEditExpenseAmt(exp.amount);
    setEditExpenseDesc(exp.desc);
    setEditExpensePay(exp.payment as any);
    setEditExpenseDate(exp.date);
  };

  const handleSaveExpenseEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseToEdit) return;
    updateExpense(expenseToEdit.id, {
      category: editExpenseCat,
      amount: editExpenseAmt,
      desc: editExpenseDesc.trim() || editExpenseCat,
      payment: editExpensePay,
      date: editExpenseDate,
    });
    setExpenseToEdit(null);
  };

  // Filter range
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      return null;
    }
    return { start, end };
  }, [period]);

  // Cyber Sales
  // NOTE: Reports was originally built as a combined P&L across
  // Cyber+Gas+Electronics regardless of which business was active -
  // that directly conflicts with per-business isolation ("Shop
  // reports" must only ever show Shop data). Each of the three
  // sources below now returns nothing unless IT is the active
  // business, so switching businesses switches Reports along with
  // everything else. (General Shop/Clothing/Restaurant/Pharmacy/Other
  // aren't wired into this P&L at all yet - their sales live in
  // `generalSales` - so Reports intentionally shows zero rather than
  // leaking another vertical's numbers for those modes; a dedicated
  // General-Shop P&L is a good follow-up.)
  const periodCyberSales = useMemo(() => {
    if (businessMode !== 'cyber') return [];
    return transactions.filter((t) => {
      if (t.status === 'cancelled' || t.payment === 'Credit / Debt') return false;
      if (!dateRange) return true;
      const d = new Date(t.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [transactions, dateRange, businessMode]);

  // Gas Sales
  const periodGasSales = useMemo(() => {
    if (businessMode !== 'gas') return [];
    return gasTransactions.filter((g) => {
      if (!dateRange) return true;
      const d = new Date(g.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [gasTransactions, dateRange, businessMode]);

  // Electronics Sales
  const periodElectronicsSales = useMemo(() => {
    if (businessMode !== 'electronics') return [];
    return electronicsSales.filter((e) => {
      if (!dateRange) return true;
      const d = new Date(e.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [electronicsSales, dateRange, businessMode]);

  // Expenses
  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!dateRange) return true;
      const d = new Date(e.date.includes('T') ? e.date : e.date + 'T00:00:00');
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [expenses, dateRange]);

  // Family Drawings
  const periodFamily = useMemo(() => {
    return familyExpenses.filter((f) => {
      if (!dateRange) return true;
      const d = new Date(f.date.includes('T') ? f.date : f.date + 'T00:00:00');
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [familyExpenses, dateRange]);

  // Aggregates
  const pnl = useMemo(() => {
    const cyberRev = periodCyberSales.reduce((sum, t) => sum + t.total, 0);
    const cyberCost = periodCyberSales.reduce((sum, t) => sum + (t.materialTotal || 0), 0);

    const gasRev = periodGasSales.reduce((sum, g) => sum + g.total, 0);
    const gasCost = periodGasSales.reduce((sum, g) => sum + (g.cost || 0) * (g.qty || 1), 0);

    const elRev = periodElectronicsSales.reduce((sum, e) => sum + e.total, 0);
    const elCost = periodElectronicsSales.reduce((sum, e) => sum + (e.cost || 0), 0);

    const totalGrossRevenue = cyberRev + gasRev + elRev;
    const totalMaterialsCost = cyberCost + gasCost + elCost;
    const grossProfit = totalGrossRevenue - totalMaterialsCost;

    const totalOperatingExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netBusinessProfit = grossProfit - totalOperatingExpenses;

    const totalFamilyDrawings = periodFamily.reduce((sum, f) => sum + f.amount, 0);
    const finalRetainedEarnings = netBusinessProfit - totalFamilyDrawings;

    const profitMargin = totalGrossRevenue > 0 ? ((netBusinessProfit / totalGrossRevenue) * 100).toFixed(1) : '0.0';

    return {
      cyberRev,
      cyberCost,
      gasRev,
      gasCost,
      elRev,
      elCost,
      totalGrossRevenue,
      totalMaterialsCost,
      grossProfit,
      totalOperatingExpenses,
      netBusinessProfit,
      totalFamilyDrawings,
      finalRetainedEarnings,
      profitMargin,
    };
  }, [periodCyberSales, periodGasSales, periodElectronicsSales, periodExpenses, periodFamily]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = { Cash: 0, 'M-Pesa': 0, Card: 0, Bank: 0, 'Credit / Debt': 0 };
    periodCyberSales.forEach((t) => {
      map[t.payment] = (map[t.payment] || 0) + t.total;
    });
    periodGasSales.forEach((g) => {
      map[g.payment] = (map[g.payment] || 0) + g.total;
    });
    periodElectronicsSales.forEach((e) => {
      map[e.payment] = (map[e.payment] || 0) + e.total;
    });
    return map;
  }, [periodCyberSales, periodGasSales, periodElectronicsSales]);

  // Unified P&L Contributing Ledger Entries
  const ledgerEntries = useMemo(() => {
    const list: Array<{
      id: string | number;
      type: 'cyber' | 'gas' | 'electronics' | 'expense' | 'family';
      receipt: string;
      date: string;
      category: string;
      desc: string;
      party: string;
      payment: string;
      grossAmount: number;
      cogsAmount: number;
      netImpact: number;
      raw: any;
    }> = [];

    periodCyberSales.forEach((t) => {
      const itemsList = t.items && t.items.length > 0 ? t.items.map((i) => `${i.qty}x ${i.name}`).join(', ') : '';
      list.push({
        id: t.id,
        type: 'cyber',
        receipt: t.receipt,
        date: t.date,
        category: 'Cyber & POS',
        desc: t.service ? `${t.service}${itemsList ? ` (${itemsList})` : ''}` : itemsList || 'Cyber service',
        party: t.customer || 'Walk-in Customer',
        payment: t.payment || 'Cash',
        grossAmount: t.total,
        cogsAmount: t.materialTotal || 0,
        netImpact: t.total - (t.materialTotal || 0),
        raw: t,
      });
    });

    periodGasSales.forEach((g) => {
      list.push({
        id: g.id,
        type: 'gas',
        receipt: g.receipt,
        date: g.date,
        category: 'Gas Station',
        desc: `${g.brand} ${g.size} (Qty: ${g.qty})`,
        party: g.customer || 'Walk-in Customer',
        payment: g.payment || 'Cash',
        grossAmount: g.total,
        cogsAmount: (g.cost || 0) * (g.qty || 1),
        netImpact: g.total - (g.cost || 0) * (g.qty || 1),
        raw: g,
      });
    });

    periodElectronicsSales.forEach((e) => {
      list.push({
        id: e.id,
        type: 'electronics',
        receipt: e.receipt,
        date: e.date,
        category: 'Electronics',
        desc: `${e.qty || 1}x ${e.product || 'Electronics Item'}`,
        party: e.customer || 'Walk-in Customer',
        payment: e.payment || 'Cash',
        grossAmount: e.total,
        cogsAmount: e.cost || 0,
        netImpact: e.total - (e.cost || 0),
        raw: e,
      });
    });

    periodExpenses.forEach((exp) => {
      list.push({
        id: exp.id,
        type: 'expense',
        receipt: `EXP-${exp.id}`,
        date: exp.date,
        category: `Overhead: ${exp.category || 'General'}`,
        desc: exp.desc,
        party: exp.staff || 'Shop Expense',
        payment: exp.payment || 'Cash',
        grossAmount: -exp.amount,
        cogsAmount: 0,
        netImpact: -exp.amount,
        raw: exp,
      });
    });

    periodFamily.forEach((f) => {
      list.push({
        id: f.id,
        type: 'family',
        receipt: typeof f.id === 'string' && f.id.startsWith('FEXP_') ? f.id : `FEXP-${f.id}`,
        date: f.date,
        category: 'Owner Drawing',
        desc: f.note ? `${f.name}: ${f.note}` : f.name || 'Owner Withdrawal',
        party: f.name || 'Family Member',
        payment: f.payment || 'Cash',
        grossAmount: -f.amount,
        cogsAmount: 0,
        netImpact: -f.amount,
        raw: f,
      });
    });

    // Sort newest date first
    return list.sort((a, b) => {
      const timeA = new Date(a.date.includes('T') ? a.date : a.date + 'T00:00:00').getTime();
      const timeB = new Date(b.date.includes('T') ? b.date : b.date + 'T00:00:00').getTime();
      return timeB - timeA;
    });
  }, [periodCyberSales, periodGasSales, periodElectronicsSales, periodExpenses, periodFamily]);

  // Filtered Ledger
  const filteredLedger = useMemo(() => {
    return ledgerEntries.filter((item) => {
      if (ledgerFilter !== 'all' && item.type !== ledgerFilter) return false;
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase();
        const matchReceipt = item.receipt.toLowerCase().includes(q);
        const matchDesc = item.desc.toLowerCase().includes(q);
        const matchParty = item.party.toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        const matchPayment = item.payment.toLowerCase().includes(q);
        const matchAmt = String(Math.abs(item.grossAmount)).includes(q);
        if (!matchReceipt && !matchDesc && !matchParty && !matchCategory && !matchPayment && !matchAmt) {
          return false;
        }
      }
      return true;
    });
  }, [ledgerEntries, ledgerFilter, ledgerSearch]);

  const handlePrint = () => {
    window.print();
  };

  /**
   * Exports exactly what's currently shown in the ledger table (respects
   * the active period/type/search filters) as a CSV file the person can
   * open in Excel, Google Sheets, or send to an accountant.
   */
  const handleExportCsv = () => {
    if (filteredLedger.length === 0) {
      addToast({ type: 'error', title: 'Nothing to export', message: 'No records match the current filter.' });
      return;
    }

    const headers = ['Date', 'Receipt', 'Category', 'Description', 'Customer/Party', 'Payment Method', 'Amount (KES)', 'Cost (KES)', 'Net Impact (KES)'];

    const escapeCsvField = (value: string): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredLedger.map((item) => [
      item.date,
      item.receipt,
      item.category,
      item.desc,
      item.party,
      item.payment,
      item.grossAmount.toFixed(2),
      item.cogsAmount.toFixed(2),
      item.netImpact.toFixed(2),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
    // Leading BOM so Excel opens UTF-8 (KES amounts, names) correctly rather than mangling it.
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `sellora-report-${period}-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'Export complete',
      message: `Exported ${filteredLedger.length} record${filteredLedger.length === 1 ? '' : 's'} to CSV.`,
    });
  };

  const scrollToLedger = (filterType: 'all' | 'cyber' | 'gas' | 'electronics' | 'expense' | 'family') => {
    setLedgerFilter(filterType);
    if (ledgerTableRef.current) {
      ledgerTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-200 border border-white/20 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-blue-300" />
              <span>Commercial Accounting & Financial Statements</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              📊 Profit & Loss (P&L) Financial Reports
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Strict Kenyan business accounting standards. Calculates Gross Sales, Cost of Goods (COGS), Gross Profit, Operating Overhead, and True Net Earnings with secure password deletion audits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const format = profile.receiptFormat === '58mm' ? '58' : profile.receiptFormat === 'a4' ? 'A4' : '80';
                const periodLabel =
                  period === 'today' ? 'Today (Shift Close)' :
                  period === 'week' ? 'Last 7 Days' :
                  period === 'month' ? 'This Month' :
                  period === 'year' ? 'This Year' : 'All Time';

                addToast({
                  type: 'info',
                  title: '🖨️ Printing Z-Report...',
                  message: `Sending ${periodLabel} summary to thermal printer...`,
                });

                executeShiftReportPrint({
                  profile,
                  format,
                  formatMoney,
                  periodName: periodLabel,
                  cashierName: currentUser?.name || 'Shift Cashier',
                  grossSales: pnl.totalGrossRevenue,
                  netSales: pnl.totalGrossRevenue,
                  cogs: pnl.totalMaterialsCost,
                  grossProfit: pnl.grossProfit,
                  operatingExpenses: pnl.totalOperatingExpenses,
                  netProfit: pnl.netBusinessProfit,
                  cashInDrawer: paymentBreakdown.Cash || 0,
                  paymentsBreakdown: {
                    cash: paymentBreakdown.Cash || 0,
                    mpesa: paymentBreakdown['M-Pesa'] || 0,
                    card: (paymentBreakdown.Card || 0) + (paymentBreakdown.Bank || 0),
                    debt: paymentBreakdown['Credit / Debt'] || 0,
                  },
                  categoryBreakdown: [
                    { name: 'Cyber & POS', amount: pnl.cyberRev },
                    { name: 'Cooking Gas (LPG)', amount: pnl.gasRev },
                    { name: 'Electronics & Repairs', amount: pnl.elRev },
                  ].filter((c) => c.amount > 0),
                  transactionCount: periodCyberSales.length + periodGasSales.length + periodElectronicsSales.length,
                });
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-md active:scale-95"
              title="Print standard thermal register shift reconciliation slip"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Thermal Z-Report</span>
            </button>

            <button
              onClick={() => {
                const format = profile.receiptFormat === '58mm' ? '58' : profile.receiptFormat === 'a4' ? 'A4' : '80';
                const periodLabel =
                  period === 'today' ? 'Today (Shift Close)' :
                  period === 'week' ? 'Last 7 Days' :
                  period === 'month' ? 'This Month' :
                  period === 'year' ? 'This Year' : 'All Time';

                openShiftReportInNewTab({
                  profile,
                  format,
                  formatMoney,
                  periodName: periodLabel,
                  cashierName: currentUser?.name || 'Shift Cashier',
                  grossSales: pnl.totalGrossRevenue,
                  netSales: pnl.totalGrossRevenue,
                  cogs: pnl.totalMaterialsCost,
                  grossProfit: pnl.grossProfit,
                  operatingExpenses: pnl.totalOperatingExpenses,
                  netProfit: pnl.netBusinessProfit,
                  cashInDrawer: paymentBreakdown.Cash || 0,
                  paymentsBreakdown: {
                    cash: paymentBreakdown.Cash || 0,
                    mpesa: paymentBreakdown['M-Pesa'] || 0,
                    card: (paymentBreakdown.Card || 0) + (paymentBreakdown.Bank || 0),
                    debt: paymentBreakdown['Credit / Debt'] || 0,
                  },
                  categoryBreakdown: [
                    { name: 'Cyber & POS', amount: pnl.cyberRev },
                    { name: 'Cooking Gas (LPG)', amount: pnl.gasRev },
                    { name: 'Electronics & Repairs', amount: pnl.elRev },
                  ].filter((c) => c.amount > 0),
                  transactionCount: periodCyberSales.length + periodGasSales.length + periodElectronicsSales.length,
                });
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
              title="Open Thermal Z-Report preview in new tab"
            >
              <span>Z-Slip Tab</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
              title="Export the current ledger view as a CSV file"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>P&L Statement (A4)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Period Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reporting Interval</h3>
        </div>

        <div className="flex items-center p-1 rounded-2xl bg-slate-200 dark:bg-slate-800 text-xs font-bold overflow-x-auto max-w-full">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              period === 'today' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              period === 'week' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              period === 'month' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              period === 'year' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            This Year
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              period === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Main Official P&L Statement Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              STATEMENT OF FINANCIAL PERFORMANCE
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
              Income & Expenditure Statement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Entity: {profile.name || 'Sellora POS'} • Currency: KES • Reporting Period:{' '}
              <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{period}</span>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-right">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Net Profit Margin</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{pnl.profitMargin}%</p>
          </div>
        </div>

        {/* P&L Line Items */}
        <div className="space-y-6 text-sm">
          {/* 1. REVENUE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold uppercase tracking-wider text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <span>1. Total Revenue / Gross Turnover</span>
              </h4>
              <button
                onClick={() => scrollToLedger('all')}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Audit all records in ledger</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5 pl-4 border-l-2 border-blue-200 dark:border-blue-900">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>Cyber, Printing & Photocopy Services:</span>
                  <button
                    onClick={() => scrollToLedger('cyber')}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                    title="Filter ledger to cyber sales"
                  >
                    {periodCyberSales.length} sales
                  </button>
                </div>
                <span className="font-mono font-semibold">{formatMoney(pnl.cyberRev)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>Gas Cylinder Refills & Sales:</span>
                  <button
                    onClick={() => scrollToLedger('gas')}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                    title="Filter ledger to gas refill records"
                  >
                    {periodGasSales.length} refills
                  </button>
                </div>
                <span className="font-mono font-semibold">{formatMoney(pnl.gasRev)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>Electronics & Phone Accessories:</span>
                  <button
                    onClick={() => scrollToLedger('electronics')}
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800 hover:bg-purple-100 transition-colors"
                    title="Filter ledger to electronics sales"
                  >
                    {periodElectronicsSales.length} sales
                  </button>
                </div>
                <span className="font-mono font-semibold">{formatMoney(pnl.elRev)}</span>
              </div>

              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-black text-slate-900 dark:text-white">
                <span>TOTAL GROSS REVENUE:</span>
                <span className="font-mono text-base text-blue-600 dark:text-blue-400">{formatMoney(pnl.totalGrossRevenue)}</span>
              </div>
            </div>
          </div>

          {/* 2. COST OF GOODS (COGS) */}
          <div>
            <h4 className="font-extrabold uppercase tracking-wider text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
              <span>2. Cost of Sales & Direct Consumables (COGS)</span>
            </h4>
            <div className="space-y-2 pl-4 border-l-2 border-amber-200 dark:border-amber-900">
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Paper, Toner, Laminating Pouches & Envelopes:</span>
                <span className="font-mono text-rose-600">-{formatMoney(pnl.cyberCost)}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Wholesale Gas Refill Cylinder Purchases:</span>
                <span className="font-mono text-rose-600">-{formatMoney(pnl.gasCost)}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Electronics Wholesale Inventory Purchases:</span>
                <span className="font-mono text-rose-600">-{formatMoney(pnl.elCost)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-black text-slate-900 dark:text-white">
                <span>TOTAL MATERIAL & INVENTORY COSTS:</span>
                <span className="font-mono text-base text-rose-600">-{formatMoney(pnl.totalMaterialsCost)}</span>
              </div>
            </div>
          </div>

          {/* GROSS PROFIT HIGHLIGHT */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex justify-between items-center font-black">
            <span className="text-slate-900 dark:text-white uppercase tracking-wider text-xs">
              GROSS OPERATING MARGIN:
            </span>
            <span className="font-mono text-lg text-emerald-600 dark:text-emerald-400">
              {formatMoney(pnl.grossProfit)}
            </span>
          </div>

          {/* 3. OPERATING OVERHEAD (EXPENSES) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold uppercase tracking-wider text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <span>3. Operating Overhead & Shop Expenses</span>
              </h4>
              <button
                onClick={() => scrollToLedger('expense')}
                className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <span>{periodExpenses.length} expense records</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2 pl-4 border-l-2 border-rose-200 dark:border-rose-900">
              {periodExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs py-0.5">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                      {exp.category}:
                    </span>
                    <span className="text-slate-500 truncate">{exp.desc}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-rose-600 mr-1">-{formatMoney(exp.amount)}</span>
                    <button
                      onClick={() => openExpenseEditor(exp)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      title="Edit Expense"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setItemToDelete({
                          id: exp.id,
                          type: 'expense',
                          receipt: `EXP-${exp.id}`,
                          desc: `${exp.category}: ${exp.desc}`,
                          amount: exp.amount,
                          total: exp.amount,
                          date: exp.date,
                          customer: exp.staff,
                        })
                      }
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Expense (Password Required)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {periodExpenses.length === 0 && (
                <div className="text-slate-400 text-xs italic">No expenses recorded for this period.</div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-black text-slate-900 dark:text-white">
                <span>TOTAL SHOP OVERHEAD:</span>
                <span className="font-mono text-base text-rose-600">-{formatMoney(pnl.totalOperatingExpenses)}</span>
              </div>
            </div>
          </div>

          {/* 4. NET BUSINESS PROFIT */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center font-black shadow-lg">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold block text-emerald-100">
                TRUE NET BUSINESS PROFIT
              </span>
              <span className="text-[11px] text-emerald-200 font-normal">
                Net earned before family withdrawals
              </span>
            </div>
            <span className="font-mono text-2xl tracking-tight">
              {formatMoney(pnl.netBusinessProfit)}
            </span>
          </div>

          {/* 5. FAMILY WITHDRAWALS & RETAINED CASH */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Less Owner / Family Drawings:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollToLedger('family')}
                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  {periodFamily.length} withdrawals
                </button>
                <span className="font-mono text-amber-600 font-bold">-{formatMoney(pnl.totalFamilyDrawings)}</span>
              </div>
            </div>

            {periodFamily.length > 0 && (
              <div className="space-y-1.5 pl-3 border-l-2 border-amber-200 dark:border-amber-900/60">
                {periodFamily.map((fam) => (
                  <div key={fam.id} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="truncate pr-2">
                      {fam.name} {fam.note ? `— ${fam.note}` : ''}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-amber-600">-{formatMoney(fam.amount)}</span>
                      <button
                        onClick={() =>
                          setItemToDelete({
                            id: fam.id,
                            type: 'family',
                            receipt: typeof fam.id === 'string' && fam.id.startsWith('FEXP_') ? fam.id : `FEXP-${fam.id}`,
                            desc: `Family withdrawal: ${fam.name}`,
                            amount: fam.amount,
                            total: fam.amount,
                            date: fam.date,
                            name: fam.name,
                          })
                        }
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete Family Drawing (Password Required)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white text-sm">
              <span>RETAINED FREE CASH FLOW (Safe Capital to Reinvest):</span>
              <span className={`font-mono text-base ${pnl.finalRetainedEarnings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                {formatMoney(pnl.finalRetainedEarnings)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Channel Breakdown */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Payment Methods Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(paymentBreakdown).map(([method, amt]) => (
            <div key={method} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-400">{method}</span>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{formatMoney(Number(amt))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* UNDER P&L: ITEMIZATION AND SECURE TRANSACTION DELETION LEDGER */}
      <div
        ref={ledgerTableRef}
        id="pnl-ledger-section"
        className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6"
      >
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <ReceiptText className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                P&L Itemized Transactions & Deletion Control
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Browse every underlying sale, purchase cost, overhead expense, and drawing contributing to this P&L period. Click the red trash icon to delete any incorrect record with administrator password protection.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {filteredLedger.length} of {ledgerEntries.length} Records
            </span>
          </div>
        </div>

        {/* Filter Tabs & Search Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setLedgerFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                ledgerFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>All Contributing</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600">
                {ledgerEntries.length}
              </span>
            </button>
            <button
              onClick={() => setLedgerFilter('cyber')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                ledgerFilter === 'cyber'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Cyber & POS</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                {periodCyberSales.length}
              </span>
            </button>
            <button
              onClick={() => setLedgerFilter('gas')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                ledgerFilter === 'gas'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Gas Refills</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                {periodGasSales.length}
              </span>
            </button>
            <button
              onClick={() => setLedgerFilter('electronics')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                ledgerFilter === 'electronics'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Electronics</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                {periodElectronicsSales.length}
              </span>
            </button>
            <button
              onClick={() => setLedgerFilter('expense')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                ledgerFilter === 'expense'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Expenses</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                {periodExpenses.length}
              </span>
            </button>
            <button
              onClick={() => setLedgerFilter('family')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                ledgerFilter === 'family'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Drawings</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                {periodFamily.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Search receipt, customer, item..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {ledgerSearch && (
              <button
                onClick={() => setLedgerSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-extrabold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-3">Type & Ref</th>
                  <th className="py-3 px-4">Details / Service</th>
                  <th className="py-3 px-3">Party / Staff</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-4 text-right">Gross Inflow / Outflow</th>
                  <th className="py-3 px-3 text-right">COGS Cost</th>
                  <th className="py-3 px-4 text-right">Profit Contribution</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                      No matching records found for this period and filter.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => {
                    const isRevenue = entry.grossAmount >= 0;
                    const dateObj = new Date(entry.date.includes('T') ? entry.date : entry.date + 'T00:00:00');
                    const formattedDate = dateObj.toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    });
                    const formattedTime = dateObj.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr
                        key={`${entry.type}-${entry.id}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Date / Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {formattedDate}
                          </div>
                          <div className="text-[10px] text-slate-400">{formattedTime}</div>
                        </td>

                        {/* Type & Ref */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {entry.type === 'cyber' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800">
                                Cyber
                              </span>
                            )}
                            {entry.type === 'gas' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
                                Gas
                              </span>
                            )}
                            {entry.type === 'electronics' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800">
                                Electronics
                              </span>
                            )}
                            {entry.type === 'expense' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800">
                                Expense
                              </span>
                            )}
                            {entry.type === 'family' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                                Drawing
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 font-bold block mt-0.5">
                            {entry.receipt}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-slate-900 dark:text-white truncate" title={entry.desc}>
                            {entry.desc}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{entry.category}</div>
                        </td>

                        {/* Party / Staff */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]" title={entry.party}>
                              {entry.party}
                            </span>
                          </div>
                          {entry.staff && entry.staff !== entry.party && (
                            <span className="text-[10px] text-slate-400 block truncate">
                              By: {entry.staff}
                            </span>
                          )}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                            {entry.payment}
                          </span>
                        </td>

                        {/* Gross Inflow / Outflow */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold">
                          {isRevenue ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              +{formatMoney(entry.grossAmount)}
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">
                              -{formatMoney(Math.abs(entry.grossAmount))}
                            </span>
                          )}
                        </td>

                        {/* COGS Cost */}
                        <td className="py-3 px-3 text-right whitespace-nowrap font-mono text-[11px] text-slate-500">
                          {entry.cogsAmount > 0 ? `-${formatMoney(entry.cogsAmount)}` : '—'}
                        </td>

                        {/* Profit Contribution */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold">
                          <span
                            className={
                              entry.netImpact > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : entry.netImpact < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-500'
                            }
                          >
                            {entry.netImpact > 0 ? '+' : ''}
                            {formatMoney(entry.netImpact)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {entry.type === 'cyber' && onOpenReceipt && (
                              <button
                                onClick={() => onOpenReceipt(entry.raw)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                                title="View Receipt"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {entry.type === 'expense' && (
                              <button
                                onClick={() => {
                                  const exp = expenses.find((e) => e.id === entry.id);
                                  if (exp) openExpenseEditor(exp);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                                title="Edit Expense Entry"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() =>
                                setItemToDelete({
                                  id: entry.id,
                                  type: entry.type,
                                  receipt: entry.receipt,
                                  customer: entry.party,
                                  total: Math.abs(entry.grossAmount),
                                  amount: Math.abs(entry.grossAmount),
                                  date: entry.date,
                                  desc: entry.desc,
                                  service: entry.desc,
                                  name: entry.party,
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors group"
                              title="Delete Record from P&L (Password Required)"
                            >
                              <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reusable Password-Protected Deletion Modal */}
      {itemToDelete && (
        <DeleteTransactionModal
          isOpen={!!itemToDelete}
          item={itemToDelete}
          onClose={() => setItemToDelete(null)}
          onSuccess={() => {
            setItemToDelete(null);
          }}
        />
      )}

      {/* Edit Expense Modal in ReportsView */}
      {expenseToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                  Expense ID #{expenseToEdit.id}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Edit Expense
                </h3>
              </div>
              <button
                onClick={() => setExpenseToEdit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpenseEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  required
                  value={editExpenseCat}
                  onChange={(e) => setEditExpenseCat(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Amount (KES)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editExpenseAmt}
                    onChange={(e) => setEditExpenseAmt(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={editExpensePay}
                    onChange={(e) => setEditExpensePay(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Cash">Cash Drawer</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={editExpenseDate}
                  onChange={(e) => setEditExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Description / Note
                </label>
                <textarea
                  rows={2}
                  required
                  value={editExpenseDesc}
                  onChange={(e) => setEditExpenseDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setExpenseToEdit(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
