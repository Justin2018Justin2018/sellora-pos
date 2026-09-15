import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Receipt,
  Plus,
  Search,
  Trash2,
  Edit2,
  Calendar,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  X,
  CheckCircle2,
  Filter,
  CreditCard,
  User,
  DollarSign
} from 'lucide-react';
import { Expense, PaymentMethod } from '../../types/pos';

export type ExpenseCategory =
  | 'Rent'
  | 'Shop Rent'
  | 'Electricity / Tokens'
  | 'Internet / Wi-Fi'
  | 'Internet / Wi-Fi Bundle'
  | 'Staff Wages'
  | 'Staff Daily Wages'
  | 'Maintenance / Repairs'
  | 'Machine Repairs & Maintenance'
  | 'Paper & Consumables'
  | 'Paper & Toners / Stationery Restock'
  | 'Tea & Refreshments'
  | 'Tea / Lunch / Miscellaneous'
  | 'Licenses & Council'
  | 'Cleaning & Sanitation'
  | 'Other Expenses';

export const ExpensesView: React.FC = () => {
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    formatMoney,
    hasRole,
    addToast,
  } = usePOS();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Expense Form State
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('Electricity / Tokens');
  const [newAmount, setNewAmount] = useState<number>(500);
  const [newDesc, setNewDesc] = useState('');
  const [newPayment, setNewPayment] = useState<PaymentMethod>('M-Pesa');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Edit Expense Modal State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editCategory, setEditCategory] = useState<string>('Electricity / Tokens');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDesc, setEditDesc] = useState<string>('');
  const [editPayment, setEditPayment] = useState<PaymentMethod>('M-Pesa');
  const [editDate, setEditDate] = useState<string>('');
  const [editStaff, setEditStaff] = useState<string>('');

  // Delete Expense Confirmation Modal State
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletePassword, setDeletePassword] = useState<string>('');

  // Expense categories list
  const categoryOptions: ExpenseCategory[] = [
    'Rent',
    'Electricity / Tokens',
    'Internet / Wi-Fi',
    'Staff Wages',
    'Maintenance / Repairs',
    'Paper & Consumables',
    'Tea & Refreshments',
    'Licenses & Council',
    'Cleaning & Sanitation',
    'Other Expenses',
  ];

  // Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthStr = new Date().toISOString().slice(0, 7);

    let todayTotal = 0;
    let monthTotal = 0;
    let allTimeTotal = 0;

    expenses.forEach((e) => {
      const amt = Number(e.amount || 0);
      allTimeTotal += amt;
      if (e.date === todayStr) todayTotal += amt;
      if (e.date.slice(0, 7) === thisMonthStr) monthTotal += amt;
    });

    return { todayTotal, monthTotal, allTimeTotal };
  }, [expenses]);

  // Filtered expenses
  const displayedExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && ![e.category, e.desc, e.staff, e.payment].some((v) => String(v || '').toLowerCase().includes(q))) {
        return false;
      }
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (paymentFilter !== 'all' && e.payment !== paymentFilter) return false;
      return true;
    });
  }, [expenses, searchQuery, categoryFilter, paymentFilter]);

  // Filtered total amount
  const displayedTotalAmount = useMemo(() => {
    return displayedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [displayedExpenses]);

  // Submit expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAmount <= 0) {
      addToast({ type: 'error', title: 'Invalid Amount', message: 'Expense amount must be greater than 0.' });
      return;
    }

    addExpense({
      category: newCategory,
      amount: newAmount,
      desc: newDesc.trim() || newCategory,
      payment: newPayment,
      date: newDate,
    });

    setNewAmount(500);
    setNewDesc('');
  };

  // Open Edit Modal
  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditCategory(exp.category);
    setEditAmount(exp.amount);
    setEditDesc(exp.desc);
    setEditPayment(exp.payment);
    setEditDate(exp.date);
    setEditStaff(exp.staff || 'Cashier');
  };

  // Save Edit Changes
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (editAmount <= 0) {
      addToast({ type: 'error', title: 'Invalid Amount', message: 'Expense amount must be greater than 0.' });
      return;
    }

    updateExpense(editingExpense.id, {
      category: editCategory,
      amount: editAmount,
      desc: editDesc.trim() || editCategory,
      payment: editPayment,
      date: editDate,
      staff: editStaff.trim() || editingExpense.staff,
    });

    setEditingExpense(null);
  };

  // Confirm Delete
  const handleConfirmDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseToDelete) return;

    const success = deleteExpense(expenseToDelete.id, deletePassword);
    if (success) {
      setExpenseToDelete(null);
      setDeletePassword('');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount (KES)', 'Payment Method', 'Recorded By'];
    const rows = displayedExpenses.map((e) => [
      e.date,
      `"${e.category}"`,
      `"${e.desc}"`,
      e.amount,
      e.payment,
      `"${e.staff || 'Cashier'}"`,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `Shop_Expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-rose-200 border border-white/20 mb-2">
              <Receipt className="w-3.5 h-3.5" />
              <span>Operational Cost Control</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              📉 Shop Expenses & Expense Ledger
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-rose-100 max-w-xl">
              Log, edit, and audit daily power tokens, internet bundles, rent, and repairs. Every entry reflects directly in your net profit calculations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Today's Expenses</span>
          <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatMoney(stats.todayTotal)}
          </h4>
          <span className="text-xs text-slate-500">Recorded for current date</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">This Month's Total</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(stats.monthTotal)}
          </h4>
          <span className="text-xs text-slate-500">Current calendar month</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">All-Time Recorded</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(stats.allTimeTotal)}
          </h4>
          <span className="text-xs text-slate-500">{expenses.length} total expense entries</span>
        </div>
      </div>

      {/* Record Expense Form */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-rose-600" />
          <span>Record Shop Expense</span>
        </h3>

        <form onSubmit={handleAddExpense} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="newExpenseCategory" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Expense Category
              </label>
              <select
                id="newExpenseCategory"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="newExpenseAmount" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Amount (KES)
              </label>
              <input
                id="newExpenseAmount"
                type="number"
                min="1"
                required
                value={newAmount}
                onChange={(e) => setNewAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="newExpensePayment" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Payment Method
              </label>
              <select
                id="newExpensePayment"
                value={newPayment}
                onChange={(e) => setNewPayment(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="M-Pesa">M-Pesa</option>
                <option value="Cash">Cash Drawer</option>
                <option value="Bank">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label htmlFor="newExpenseDate" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                id="newExpenseDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="newExpenseDesc" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Expense Description / Notes
              </label>
              <input
                id="newExpenseDesc"
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Bought KPLC power tokens 200 units, Meter # 12345678"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              id="recordExpenseSubmitBtn"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all focus:ring-2 focus:ring-rose-400 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense ({formatMoney(newAmount)})</span>
            </button>
          </div>
        </form>
      </div>

      {/* Expense Ledger Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Expense Ledger</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {displayedExpenses.length} entries
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chronological history of shop payouts — edit amounts, categories or remove records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              id="expenseCategoryFilterSelect"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Payment Method Filter */}
            <select
              id="expensePaymentFilterSelect"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="all">All Payment Types</option>
              <option value="Cash">Cash Drawer</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Bank">Bank Transfer</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="expenseSearchInput"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, staff..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Ledger Summary Bar */}
        {(categoryFilter !== 'all' || paymentFilter !== 'all' || searchQuery) && (
          <div className="mb-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Filtered: <strong>{displayedExpenses.length}</strong> items totaling{' '}
                <strong className="text-rose-600 dark:text-rose-400">-{formatMoney(displayedTotalAmount)}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                setCategoryFilter('all');
                setPaymentFilter('all');
                setSearchQuery('');
              }}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3 text-right">Amount (KES)</th>
                <th className="py-3 px-3">Staff</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap font-mono">{exp.date}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900 dark:text-white max-w-sm">
                    <span className="line-clamp-2" title={exp.desc}>{exp.desc}</span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <CreditCard className="w-2.5 h-2.5" />
                      {exp.payment}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    -{formatMoney(exp.amount)}
                  </td>
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <User className="w-2.5 h-2.5" />
                      {exp.staff || 'Cashier'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEdit(exp)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title="Edit this expense entry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          setExpenseToDelete(exp);
                          setDeletePassword('');
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Delete this expense entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {displayedExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No expense records found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                  Expense Ledger Entry #{editingExpense.id}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Edit Shop Expense
                </h3>
              </div>
              <button
                onClick={() => setEditingExpense(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Expense Category *
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Amount (KES) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={editPayment}
                    onChange={(e) => setEditPayment(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Cash">Cash Drawer</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Staff / Recorded By
                  </label>
                  <input
                    type="text"
                    value={editStaff}
                    onChange={(e) => setEditStaff(e.target.value)}
                    placeholder="Staff name"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Description / Details *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Enter details about this expense..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-700 dark:text-blue-300">
                Editing this entry will automatically recalculate today's expenses, shift cash float, and P&L financial reports.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="saveExpenseEditBtn"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE EXPENSE CONFIRMATION MODAL */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Delete Expense Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action will permanently remove this expense from the ledger.
                </p>
              </div>
            </div>

            {/* Expense details summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{expenseToDelete.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Description:</span>
                <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]" title={expenseToDelete.desc}>
                  {expenseToDelete.desc}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date & Method:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{expenseToDelete.date} ({expenseToDelete.payment})</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 font-bold">Amount to Deduct:</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                  -{formatMoney(expenseToDelete.amount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Admin Authorization Password (optional)
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter admin password (e.g. 1234 or admin)"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExpenseToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="confirmDeleteExpenseBtn"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Expense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
