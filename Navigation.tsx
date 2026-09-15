import React from 'react';
import { usePOS } from '../../context/POSContext';
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
  Bot
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'sale'
  | 'gas'
  | 'electronics'
  | 'general_products'
  | 'general_purchases'
  | 'general_categories'
  | 'general_suppliers'
  | 'general_profit'
  | 'transactions'
  | 'stock'
  | 'services'
  | 'debts'
  | 'expenses'
  | 'customers'
  | 'advertising'
  | 'family'
  | 'reports'
  | 'staff'
  | 'settings'
  | 'ai';

interface NavigationProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  const { lowStockItems, debts } = usePOS();

  const outstandingDebtsCount = debts.filter((d) => d.original - d.paid > 0).length;

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }> = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'sale', label: 'New Sale', icon: ShoppingCart },
    { key: 'gas', label: 'Gas Refill', icon: Fuel },
    { key: 'electronics', label: 'Electronics', icon: Smartphone },
    { key: 'transactions', label: 'Transactions', icon: ReceiptText },
    {
      key: 'stock',
      label: 'Inventory',
      icon: Boxes,
      badge: lowStockItems.length > 0 ? lowStockItems.length : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    { key: 'services', label: 'Services', icon: Wrench },
    {
      key: 'debts',
      label: 'Debts',
      icon: CreditCard,
      badge: outstandingDebtsCount > 0 ? outstandingDebtsCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    { key: 'expenses', label: 'Expenses', icon: Receipt },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'advertising', label: 'Campaigns', icon: Megaphone },
    { key: 'family', label: 'Family Finance', icon: HeartHandshake },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'staff', label: 'Staff & Audit', icon: UserCog },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'ai', label: 'AI Assistant', icon: Bot },
  ];

  return (
    <nav className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-20 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 overflow-x-auto py-2.5 scrollbar-none no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onSelectTab(tab.key)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      tab.badgeColor || 'bg-blue-500 text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
