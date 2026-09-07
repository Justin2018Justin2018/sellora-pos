import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Menu,
  Search,
  PlusCircle,
  MessageSquareShare,
  Store,
  Sun,
  Moon,
  Building2,
  LogOut,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { getBusinessTypeConfig } from '../../data/businessTypes';

interface HeaderProps {
  onOpenNewSale: () => void;
  onOpenDocRequest: () => void;
  onOpenShopSwitcher: () => void;
  onOpenSetupWizard: () => void;
  onOpenSuperAdmin?: () => void;
  onOpenBusinessTypeModal?: () => void;
  onToggleMobileSidebar?: () => void;
  title?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewSale,
  onOpenDocRequest,
  onOpenShopSwitcher,
  onOpenSetupWizard,
  onOpenSuperAdmin,
  onOpenBusinessTypeModal,
  onToggleMobileSidebar,
  title = 'Business Overview',
  subtitle,
}) => {
  const {
    currentShop,
    currentTenant,
    businessMode,
    theme,
    toggleTheme,
    currentUser,
    logout,
  } = usePOS();

  const activeConfig = getBusinessTypeConfig(businessMode);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Format today's date cleanly (e.g., "Today, Oct 24, 2026")
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <header className="sticky top-0 z-20 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-xs">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle || (
              <>
                Period: <span className="font-semibold text-blue-600 dark:text-blue-400">Today, {todayFormatted}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right: Search + Action Buttons */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Quick Search Input */}
        <div className="relative hidden sm:block">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records, receipts..."
            className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 border-none rounded-lg py-2 pl-3.5 pr-9 text-xs w-44 lg:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* WhatsApp Doc Request Quick Action */}
        <button
          onClick={onOpenDocRequest}
          title="Request document via customer WhatsApp"
          className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <MessageSquareShare className="w-3.5 h-3.5 text-emerald-500" />
          <span>WhatsApp Doc</span>
        </button>

        {/* Active POS Business Type / Plan Selector */}
        {onOpenBusinessTypeModal && (
          <button
            onClick={onOpenBusinessTypeModal}
            title="Change POS Type / Subscription Plan"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
          >
            <span>{activeConfig.emoji}</span>
            <span className="font-bold">{activeConfig.shortName}</span>
            <RefreshCw className="w-2.5 h-2.5 text-blue-500 opacity-70" />
          </button>
        )}

        {/* Active Shop & Branch Switcher */}
        <button
          onClick={onOpenShopSwitcher}
          title="Switch active shop account or physical branch"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
        >
          <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="max-w-[130px] truncate">{currentTenant.shopName || currentShop.name}</span>
          <span className="text-[10px] px-1 py-0.2 rounded bg-blue-600/20 text-blue-600 dark:text-blue-400 font-bold uppercase">
            {currentTenant.plan || 'PRO'}
          </span>
        </button>

        {/* New Sale Button (Signature Professional Polish Action) */}
        <button
          onClick={onOpenNewSale}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Sale +</span>
        </button>

        {/* Dark/Light Mode */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Account Popover */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-60 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-2 text-slate-800 dark:text-slate-200 z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setShowUserMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-500 inline" />
                    {currentUser.role} • <span className="font-semibold text-blue-500">{currentTenant.shopName}</span>
                  </p>
                </div>

                {onOpenSuperAdmin && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSuperAdmin();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Super Admin Portal</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenShopSwitcher();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Store className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Switch Shop Account</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenSetupWizard();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Setup Wizard</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors mt-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
