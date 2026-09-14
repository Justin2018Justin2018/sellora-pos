import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import { getBusinessTypeConfig } from '../../data/businessTypes';
import { BusinessMode } from '../../types/pos';
import { ChevronDown, Check, Plus, Lock } from 'lucide-react';

interface BusinessSwitcherProps {
  onOpenAddBusiness: () => void;
}

/**
 * The single place in the UI that decides which business's data the
 * whole app is currently showing. Only businesses with an ACTIVE
 * subscription (see POSContext.activeBusinessTypes, backed by
 * businessSubscriptionService + Supabase RLS) ever appear here - this
 * is presentation on top of that real access-control layer, not a
 * substitute for it. Selecting a business calls setBusinessMode(),
 * which itself refuses anything not in activeBusinessTypes.
 */
export const BusinessSwitcher: React.FC<BusinessSwitcherProps> = ({ onOpenAddBusiness }) => {
  const { businessMode, setBusinessMode, activeBusinessTypes, addToast } = usePOS();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeConfig = getBusinessTypeConfig(businessMode);
  const subscribedConfigs = activeBusinessTypes
    .filter((m) => m !== 'all')
    .map((m) => getBusinessTypeConfig(m));
  const hasMultiple = subscribedConfigs.length > 1;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (mode: BusinessMode) => {
    setIsOpen(false);
    if (mode === businessMode) return;
    if (!activeBusinessTypes.includes(mode) && !activeBusinessTypes.includes('all' as BusinessMode)) {
      addToast({
        type: 'error',
        title: 'Not Subscribed',
        message: `Subscribe to ${getBusinessTypeConfig(mode).shortName} to switch into it.`,
      });
      return;
    }
    setBusinessMode(mode);
  };

  return (
    <div className="mt-3.5 relative" ref={containerRef}>
      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner">
        <div className="flex items-center justify-between gap-2">
          {/* Current active business - always shown prominently */}
          <button
            type="button"
            onClick={() => hasMultiple && setIsOpen((o) => !o)}
            className={`flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg ${
              hasMultiple ? 'cursor-pointer hover:bg-slate-800/60 -m-1 p-1' : ''
            }`}
            title={hasMultiple ? 'Switch active business' : activeConfig.name}
          >
            <span className="text-xl shrink-0">{activeConfig.emoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {activeConfig.shortName}
              </p>
              <p className="text-[10px] text-emerald-400 font-semibold truncate uppercase tracking-wide">
                Active Business
              </p>
            </div>
            {hasMultiple && (
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </button>

          <button
            onClick={onOpenAddBusiness}
            className="px-2 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 hover:text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            title="Subscribe to another business"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* Business Switcher dropdown - only rendered at all when the
            tenant has more than one active business, per spec: hide
            the switcher entirely for single-business tenants. */}
        {isOpen && hasMultiple && (
          <div className="mt-2 pt-2 border-t border-slate-800 space-y-0.5">
            <p className="px-1.5 pb-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              Switch Business
            </p>
            {subscribedConfigs.map((cfg) => (
              <button
                key={cfg.id}
                onClick={() => handleSelect(cfg.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  cfg.id === businessMode
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span className="text-base shrink-0">{cfg.emoji}</span>
                <span className="flex-1 text-left truncate">{cfg.shortName}</span>
                {cfg.id === businessMode && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </button>
            ))}
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenAddBusiness();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer mt-0.5"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left">Subscribe to another business</span>
            </button>
          </div>
        )}
      </div>

      {!hasMultiple && (
        <p className="mt-1.5 px-1 flex items-center gap-1 text-[9px] text-slate-500">
          <Lock className="w-2.5 h-2.5" />
          <span>Subscribed to 1 business. Add another to unlock switching.</span>
        </p>
      )}
    </div>
  );
};
