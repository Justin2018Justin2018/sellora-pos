import React, { useState, useEffect, useRef } from 'react';
import { usePOS } from '../../context/POSContext';
import { Transaction, GasTransaction, ElectronicsSale, Expense, FamilyExpense } from '../../types/pos';
import {
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  X,
  AlertTriangle,
  Receipt,
  Calendar,
  User,
  CreditCard
} from 'lucide-react';

export type DeletableRecordKind = 'cyber' | 'gas' | 'electronics' | 'expense' | 'family';

export interface DeletableItemDetails {
  id: string | number;
  type?: DeletableRecordKind;
  receipt?: string;
  customer?: string;
  total?: number;
  amount?: number;
  date?: string;
  service?: string;
  desc?: string;
  product?: string;
  name?: string;
  brand?: string;
  size?: string;
  qty?: number;
  payment?: string;
}

interface DeleteTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: any | null;
  item?: DeletableItemDetails | null;
  onSuccess?: () => void;
  transactionType?: DeletableRecordKind;
}

export const DeleteTransactionModal: React.FC<DeleteTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  item,
  onSuccess,
  transactionType,
}) => {
  const {
    deleteTransaction,
    deleteGasRefill,
    deleteElectronicsSale,
    deleteExpense,
    deleteFamilyExpense,
    formatMoney,
  } = usePOS();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMessage('');
      setIsSubmitting(false);
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeTarget = item || transaction;
  if (!isOpen || !activeTarget) return null;

  // Deduce type
  let resolvedType: DeletableRecordKind = transactionType || activeTarget.type || 'cyber';
  if (!transactionType && !activeTarget.type) {
    if ('brand' in activeTarget) resolvedType = 'gas';
    else if ('productId' in activeTarget) resolvedType = 'electronics';
    else if ('amount' in activeTarget && 'desc' in activeTarget) resolvedType = 'expense';
    else if ('amount' in activeTarget && 'name' in activeTarget && !('desc' in activeTarget)) resolvedType = 'family';
  }

  const receiptNo =
    activeTarget.receipt ||
    (resolvedType === 'expense'
      ? `EXP-${activeTarget.id}`
      : resolvedType === 'family'
      ? `FEXP-${activeTarget.id}`
      : `#${activeTarget.id}`);

  const customerName =
    activeTarget.customer ||
    activeTarget.name ||
    (resolvedType === 'expense' ? 'Operational Expense' : 'Walk-in Customer');

  const totalAmount =
    typeof activeTarget.total === 'number'
      ? activeTarget.total
      : typeof activeTarget.amount === 'number'
      ? activeTarget.amount
      : 0;

  const dateValue = activeTarget.date || new Date().toISOString();
  const dateStr = new Date(dateValue.includes('T') ? dateValue : dateValue + 'T00:00:00').toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const summaryDesc =
    resolvedType === 'gas'
      ? `${activeTarget.brand || ''} ${activeTarget.size || ''} (Qty: ${activeTarget.qty || 1})`.trim()
      : resolvedType === 'electronics'
      ? `${activeTarget.qty || 1}x ${activeTarget.product || 'Electronics Item'}`
      : resolvedType === 'expense'
      ? `${activeTarget.category || 'Expense'}: ${activeTarget.desc || ''}`
      : resolvedType === 'family'
      ? `Owner / Family Drawing: ${activeTarget.name || ''}`
      : activeTarget.service || 'Items / Services';

  const typeLabels: Record<DeletableRecordKind, string> = {
    cyber: 'Cyber & POS Sale',
    gas: 'Gas Refill Record',
    electronics: 'Electronics Sale',
    expense: 'Shop Expense',
    family: 'Family Drawing',
  };

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!password.trim()) {
      setErrorMessage('Please enter the administrator password to authorize deletion.');
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      let success = false;
      if (resolvedType === 'gas') {
        success = deleteGasRefill(Number(activeTarget.id), password);
      } else if (resolvedType === 'electronics') {
        success = deleteElectronicsSale(Number(activeTarget.id), password);
      } else if (resolvedType === 'expense') {
        success = deleteExpense(Number(activeTarget.id), password);
      } else if (resolvedType === 'family') {
        success = deleteFamilyExpense(activeTarget.id, password);
      } else {
        success = deleteTransaction(Number(activeTarget.id), password);
      }

      if (success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage('Incorrect administrator password. Please try again.');
        setIsSubmitting(false);
        inputRef.current?.select();
      }
    } catch {
      setErrorMessage('Failed to delete record. Please verify password and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="delete-transaction-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white">
        {/* Header with Warning Accent */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Delete {typeLabels[resolvedType] || 'Financial Record'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Password authorization required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleDelete} className="p-6 space-y-5">
          {/* Target Transaction Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                <Receipt className="w-3.5 h-3.5" />
                {receiptNo}
              </span>
              <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                {formatMoney(totalAmount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5 truncate">
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{customerName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{dateStr}</span>
              </div>
              <div className="col-span-2 text-slate-700 dark:text-slate-300 truncate font-medium">
                {summaryDesc}
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Warning:</strong> Permanently deleting this record recalculates Profit & Loss, ledger summaries, and audit balances. This action cannot be reversed.
            </span>
          </div>

          {/* Password Input Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-delete-password"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Enter Admin Security Password
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="admin-delete-password"
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Enter password to authorize"
                className={`w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white transition-all font-mono placeholder:font-sans focus:outline-none focus:ring-2 ${
                  errorMessage
                    ? 'border-rose-300 dark:border-rose-700 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 focus:border-rose-500 ring-rose-500/10'
                }`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMessage && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-rose-600/20 transition-all active:scale-98"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Deleting...' : 'Authorize & Delete'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

