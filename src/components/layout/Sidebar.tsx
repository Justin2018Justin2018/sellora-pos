import React, { useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { TabKey } from './Navigation';
import { getBusinessTypeConfig } from '../../data/businessTypes';
import { BusinessSwitcher } from '../business/BusinessSwitcher';
import {
  LayoutDashboard,
  ShoppingCart,
  Fuel,
  Smartphone,
  ReceiptText,
  Boxes,
  Wrench,
  CreditCard,
  Receipt,
  Users,
  Megaphone,
  HeartHandshake,
  BarChart3,
  UserCog,
  Settings,
  Bot,
  Printer,
  LogOut,
  X,
  Store,
  ShieldCheck,
  ChevronRight,
  Truck,
  FolderTree,
  Building2,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenShopSwitcher: () => void;
  onOpenSuperAdmin?: () => void;
  onOpenBusinessTypeModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onOpenShopSwitcher,
  onOpenSuperAdmin,
  onOpenBusinessTypeModal,
}) => {
  const {
    profile,
    currentShop,
    businessMode,
    setBusinessMode,
    lowStockItems,
    debts,
    currentUser,
    logout,
  } = usePOS();

  const activeConfig = getBusinessTypeConfig(businessMode);
  const outstandingDebtsCount = debts.filter((d) => d.original - d.paid > 0).length;

  const tabs = useMemo(() => {
    if (businessMode === 'cyber') {
      return [
        { key: 'dashboard', label: 'Cyber Overview', icon: LayoutDashboard },
        { key: 'sale', label: 'Counter POS Sale', icon: ShoppingCart },
        { key: 'services', label: 'Cyber Services & Rates', icon: Wrench },
        {
          key: 'stock',
          label: 'Materials & Papers',
          icon: Boxes,
          badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        {
          key: 'debts',
          label: 'Customer Debts',
          icon: CreditCard,
          badge: outstandingDebtsCount > 0 ? outstandingDebtsCount : undefined,
          badgeColor: 'bg-amber-500 text-white',
        },
        { key: 'expenses', label: 'Expense Tracker', icon: Receipt },
        { key: 'transactions', label: 'Recent Transactions', icon: ReceiptText },
        { key: 'reports', label: 'Reports Centre', icon: BarChart3 },
        { key: 'customers', label: 'Customer CRM', icon: Users },
        { key: 'advertising', label: 'SMS Campaigns', icon: Megaphone },
        { key: 'staff', label: 'Staff Shift Audit', icon: UserCog },
        { key: 'ai', label: 'Sellora AI', icon: Bot },
        { key: 'settings', label: 'Settings & Plan', icon: Settings },
      ];
    }

    if (businessMode === 'gas') {
      return [
        { key: 'gas', label: 'Gas Station & Cylinders', icon: Fuel },
        { key: 'sale', label: 'Cylinder Sale Console', icon: ShoppingCart },
        {
          key: 'stock',
          label: 'Cylinders Inventory',
          icon: Boxes,
          badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        { key: 'general_purchases', label: 'Stock Purchases', icon: Truck },
        { key: 'general_suppliers', label: 'Gas Suppliers', icon: Building2 },
        {
          key: 'debts',
          label: 'Customer Debts',
          icon: CreditCard,
          badge: outstandingDebtsCount > 0 ? outstandingDebtsCount : undefined,
          badgeColor: 'bg-amber-500 text-white',
        },
        { key: 'expenses', label: 'Expenses', icon: Receipt },
        { key: 'transactions', label: 'Sales History', icon: ReceiptText },
        { key: 'reports', label: 'Reports Centre', icon: BarChart3 },
        { key: 'general_profit', label: 'Profit Analysis', icon: TrendingUp },
        { key: 'customers', label: 'Customers', icon: Users },
        { key: 'settings', label: 'Settings & Plan', icon: Settings },
      ];
    }

    if (businessMode === 'electronics') {
      return [
        { key: 'electronics', label: 'Electronics & Repairs', icon: Smartphone },
        { key: 'sale', label: 'Sales & Warranty', icon: ShoppingCart },
        { key: 'general_products', label: 'Accessories Catalog', icon: Boxes },
        {
          key: 'stock',
          label: 'Serial & Stock',
          icon: Boxes,
          badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        { key: 'general_purchases', label: 'Stock Purchases', icon: Truck },
        { key: 'general_categories', label: 'Device Categories', icon: FolderTree },
        { key: 'general_suppliers', label: 'Tech Suppliers', icon: Building2 },
        {
          key: 'debts',
          label: 'Customer Debts',
          icon: CreditCard,
          badge: outstandingDebtsCount > 0 ? outstandingDebtsCount : undefined,
          badgeColor: 'bg-amber-500 text-white',
        },
        { key: 'expenses', label: 'Expenses', icon: Receipt },
        { key: 'transactions', label: 'Sales History', icon: ReceiptText },
        { key: 'reports', label: 'Reports Centre', icon: BarChart3 },
        { key: 'general_profit', label: 'Profit Analysis', icon: TrendingUp },
        { key: 'settings', label: 'Settings & Plan', icon: Settings },
      ];
    }

    if (businessMode === 'all') {
      return [
        { key: 'dashboard', label: 'Multi-Business Overview', icon: LayoutDashboard },
        { key: 'sale', label: 'Universal POS Console', icon: ShoppingCart },
        { key: 'services', label: 'Cyber Services', icon: Wrench },
        { key: 'gas', label: 'Gas Station Hub', icon: Fuel },
        { key: 'electronics', label: 'Tech & Electronics', icon: Smartphone },
        { key: 'general_products', label: 'Retail Products', icon: Boxes },
        {
          key: 'stock',
          label: 'Stock / Inventory',
          icon: Boxes,
          badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        { key: 'general_purchases', label: 'Stock Purchases', icon: Truck },
        { key: 'general_categories', label: 'Categories', icon: FolderTree },
        { key: 'general_suppliers', label: 'Suppliers', icon: Building2 },
        {
          key: 'debts',
          label: 'Customer Debts',
          icon: CreditCard,
          badge: outstandingDebtsCount > 0 ? outstandingDebtsCount : undefined,
          badgeColor: 'bg-amber-500 text-white',
        },
        { key: 'expenses', label: 'Expenses Tracker', icon: Receipt },
        { key: 'transactions', label: 'Sales History', icon: ReceiptText },
        { key: 'reports', label: 'Reports Centre', icon: BarChart3 },
        { key: 'general_profit', label: 'Profit Analysis', icon: TrendingUp },
        { key: 'customers', label: 'Customers CRM', icon: Users },
        { key: 'advertising', label: 'SMS Campaigns', icon: Megaphone },
        { key: 'family', label: 'Family Finance', icon: HeartHandshake },
        { key: 'staff', label: 'Staff Audit', icon: UserCog },
        { key: 'ai', label: 'Sellora AI', icon: Bot },
        { key: 'settings', label: 'Settings & Plan', icon: Settings },
      ];
    }

    // Default for General Shop, Clothing, Restaurant, Pharmacy, Bar, Guest House, Other
    return [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'sale', label: 'New Sale', icon: ShoppingCart },
      { key: 'general_products', label: 'Products / Catalog', icon: Boxes },
      {
        key: 'stock',
        label: 'Stock / Inventory',
        icon: Boxes,
        badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
        badgeColor: 'bg-rose-500 text-white',
      },
      { key: 'general_purchases', label: 'Stock Purchases', icon: Truck },
      { key: 'general_categories', label: 'Categories', icon: FolderTree },
      { key: 'general_suppliers', label: 'Suppliers', icon: Building2 },
      {
        key: 'debts',
        label: 'Customer Debts',
        icon: CreditCard,
        badge: outstandingDebtsCount > 0 ? outstandingDebtsCount : undefined,
        badgeColor: 'bg-amber-500 text-white',
      },
      { key: 'expenses', label: 'Expenses', icon: Receipt },
      { key: 'transactions', label: 'Sales History', icon: ReceiptText },
      { key: 'reports', label: 'Reports', icon: BarChart3 },
      { key: 'general_profit', label: 'Profit Analysis', icon: TrendingUp },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'settings', label: 'Settings', icon: Settings },
    ];
  }, [businessMode, lowStockItems.length, outstandingDebtsCount]);

  const handleTabClick = (tabKey: TabKey) => {
    onSelectTab(tabKey);
    onCloseMobile();
  };

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#0F172A] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-lg shadow-md shadow-blue-500/25 shrink-0">
              {(profile.name || 'Sellora')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-white font-bold text-base tracking-tight block leading-none truncate">
                {profile.name?.toUpperCase() || 'SELLORA POS'}
              </span>
              <p className="text-blue-400 text-[10px] uppercase font-bold tracking-widest mt-1 truncate">
                {activeConfig.name}
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active POS Business Card with Change Plan Action */}
        <div className="mt-3.5 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{activeConfig.emoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {activeConfig.shortName} POS
              </p>
              <p className="text-[10px] text-blue-400 font-semibold truncate">
                KES {activeConfig.monthlyPrice.toLocaleString()}/mo
              </p>
            </div>
          </div>

          {onOpenBusinessTypeModal && (
            <button
              onClick={onOpenBusinessTypeModal}
              className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 hover:text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              title="Change POS business type or upgrade subscription"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Change</span>
            </button>
          )}
        </div>

        {/* Real multi-business switcher - separate, fully isolated
            businesses per subscription (see AuthContext.memberships).
            Distinct from "Change" above, which just relabels this same
            shop's business type - this switches between entirely
            different shop_ids/data sets. */}
        <div className="mt-2">
          <BusinessSwitcher />
        </div>

        {/* Quick Switcher across Core Trades */}
        <div className="mt-2.5 grid grid-cols-4 gap-1 text-[10px] font-bold">
          <button
            onClick={() => setBusinessMode('cyber')}
            title="Switch to Cyber POS"
            className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              businessMode === 'cyber'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Printer className="w-3 h-3" />
            <span>Cyber</span>
          </button>
          <button
            onClick={() => setBusinessMode('gas')}
            title="Switch to Gas/LPG POS"
            className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              businessMode === 'gas'
                ? 'bg-amber-600 text-white shadow-sm font-black'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Fuel className="w-3 h-3" />
            <span>Gas</span>
          </button>
          <button
            onClick={() => setBusinessMode('electronics')}
            title="Switch to Tech/Electronics POS"
            className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              businessMode === 'electronics'
                ? 'bg-purple-600 text-white shadow-sm font-black'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            <span>Tech</span>
          </button>
          <button
            onClick={() => setBusinessMode('general_shop')}
            title="Switch to General Shop POS"
            className={`py-1.5 px-1 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
              businessMode === 'general_shop'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingCart className="w-3 h-3" />
            <span>Shop</span>
          </button>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left cursor-pointer group ${
                isActive
                  ? 'bg-blue-600/15 border-l-4 border-blue-500 text-blue-400 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="text-xs font-medium truncate">{tab.label}</span>
              </div>

              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    tab.badgeColor || 'bg-blue-500 text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Super Admin Platform Owner Quick Link */}
      {onOpenSuperAdmin && (
        <div className="px-3 pt-2">
          <button
            onClick={onOpenSuperAdmin}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/40 text-blue-300 hover:text-white transition-colors text-xs font-bold group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              <span>Super Admin Portal</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono uppercase">
              Owner
            </span>
          </button>
        </div>
      )}

      {/* User / Operator Card Footer */}
      <div className="p-3 border-t border-slate-800 bg-[#0B1120]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">
                {currentUser?.name || 'Admin User'}
              </p>
              <button
                onClick={onOpenShopSwitcher}
                className="text-[10px] text-slate-400 hover:text-blue-300 truncate flex items-center gap-1 text-left cursor-pointer"
                title="Switch branch"
              >
                <Store className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                <span className="truncate">{currentShop.name}</span>
              </button>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-60 lg:w-64 shrink-0 flex-col border-r border-slate-800/80 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
