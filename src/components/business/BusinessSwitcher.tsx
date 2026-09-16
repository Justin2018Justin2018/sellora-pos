import React, { useState } from 'react';
import { ChevronDown, Check, PlusCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBusinessTypeConfig } from '../../data/businessTypes';
import { AddBusinessModal } from './AddBusinessModal';

/**
 * Lets a customer with multiple active business subscriptions (e.g.
 * Shop + Cyber) switch which one is currently active. Per spec: hidden
 * entirely when the customer only has one active business - a switcher
 * with nothing to switch between is just clutter.
 *
 * Only ACTIVE businesses are ever offered here - switchActiveBusiness
 * itself refuses to switch into an expired/suspended one regardless,
 * but filtering the list too keeps the UI honest about what's actually
 * usable right now.
 */
export const BusinessSwitcher: React.FC = () => {
  const { memberships, shopId, switchActiveBusiness } = useAuth();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const activeMemberships = memberships.filter((m) => m.status === 'ACTIVE');
  const current = memberships.find((m) => m.shopId === shopId);
  const currentConfig = getBusinessTypeConfig(current?.businessType as any);

  // Nothing to switch between - just offer "Add Business" quietly, no dropdown chrome.
  if (activeMemberships.length <= 1) {
    return (
      <>
        <button
          onClick={() => setAddOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 dark:text-slate-400 transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add Business</span>
        </button>
        <AddBusinessModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="text-lg leading-none">{currentConfig.emoji}</span>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Active Business</p>
          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{currentConfig.shortName}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-2 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
            {activeMemberships.map((m) => {
              const config = getBusinessTypeConfig(m.businessType as any);
              const isCurrent = m.shopId === shopId;
              return (
                <button
                  key={m.shopId}
                  onClick={() => {
                    setOpen(false);
                    if (!isCurrent) switchActiveBusiness(m.shopId);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="text-base leading-none">{config.emoji}</span>
                  <span className="flex-1 text-left truncate">{m.shopName}</span>
                  {isCurrent && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
            <button
              onClick={() => {
                setOpen(false);
                setAddOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-t border-slate-100 dark:border-slate-800 font-semibold"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Business</span>
            </button>
          </div>
        </>
      )}

      <AddBusinessModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
};
