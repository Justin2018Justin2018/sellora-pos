import React, { useState, useEffect } from 'react';
import { POSProvider, usePOS } from './context/POSContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { TabKey } from './components/layout/Navigation';
import { LowStockBanner } from './components/common/LowStockBanner';
import { ToastContainer } from './components/common/ToastContainer';
import { DocRequestModal } from './components/common/DocRequestModal';
import { ShopSwitcherModal } from './components/common/ShopSwitcherModal';
import { SetupWizardModal } from './components/common/SetupWizardModal';
import { SetAdminPasswordModal } from './components/common/SetAdminPasswordModal';
import { SupabaseModal } from './components/supabase/SupabaseModal';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { SubscriptionBlockedScreen } from './components/subscription/SubscriptionBlockedScreen';
import { SubscriptionExpiryBanner } from './components/subscription/SubscriptionExpiryBanner';
import { BusinessTypeSelectionModal } from './components/subscription/BusinessTypeSelectionModal';
import { computeSubscriptionStatus } from './services/saasService';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { SaleView } from './components/pos/SaleView';
import { ReceiptModal } from './components/pos/ReceiptModal';
import { GasView } from './components/gas/GasView';
import { ElectronicsView } from './components/electronics/ElectronicsView';
import { StockView } from './components/stock/StockView';
import { ServicesView } from './components/services/ServicesView';
import { DebtsView } from './components/debts/DebtsView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { CustomersView } from './components/customers/CustomersView';
import { AdvertisingView } from './components/advertising/AdvertisingView';
import { FamilyFinanceView } from './components/family/FamilyFinanceView';
import { ReportsView } from './components/reports/ReportsView';
import { StaffView } from './components/staff/StaffView';
import { SettingsView } from './components/settings/SettingsView';
import { AIAssistantView } from './components/ai/AIAssistantView';
import { GeneralDashboardView } from './components/general/GeneralDashboardView';
import { GeneralSaleView } from './components/general/GeneralSaleView';
import { GeneralProductsView } from './components/general/GeneralProductsView';
import { GeneralStockView } from './components/general/GeneralStockView';
import { GeneralPurchasesView } from './components/general/GeneralPurchasesView';
import { GeneralCategoriesView } from './components/general/GeneralCategoriesView';
import { GeneralSuppliersView } from './components/general/GeneralSuppliersView';
import { GeneralProfitView } from './components/general/GeneralProfitView';

import { Transaction } from './types/pos';
import { Sparkles, ShieldCheck, Database } from 'lucide-react';

const TAB_TITLES: Record<TabKey, string> = {
  dashboard: 'Business Overview',
  sale: 'Sales Console',
  gas: 'Gas Refill Station',
  electronics: 'Electronics Hub & Accessories',
  transactions: 'Recent Sales & Cyber Transactions',
  stock: 'Inventory & Stock Management',
  services: 'Cyber Services & Rates',
  debts: 'Customer Debt & Credit Tracker',
  expenses: 'Expense Tracker',
  customers: 'Customer Directory & CRM',
  advertising: 'Promotional Campaigns & SMS',
  family: 'Family Finance & Drawings',
  reports: 'Reports & Business Analytics',
  staff: 'Staff Shift & Cash Drawer Audit',
  settings: 'System Configuration & Hardware',
  ai: 'Sellora AI Business Advisor',
  general_products: 'General Shop Product Catalog',
  general_purchases: 'Stock Purchases & Restocking',
  general_categories: 'Product Categories',
  general_suppliers: 'Supplier Directory',
  general_profit: 'Profit & Financial Analysis',
};

const MainApp: React.FC = () => {
  const {
    profile,
    currentShop,
    businessMode,
    isSupabaseActive,
    currentTenant,
    switchTenant,
    isSuperAdmin,
    setIsSuperAdmin,
    refreshSubscriptionStatus,
  } = usePOS();

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null);
  const [isDocRequestOpen, setIsDocRequestOpen] = useState(false);
  const [isShopSwitcherOpen, setIsShopSwitcherOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
  const [isBusinessTypeModalOpen, setIsBusinessTypeModalOpen] = useState(false);
  const [initialSaleService, setInitialSaleService] = useState<string | undefined>(undefined);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Check if first time setup is needed
  useEffect(() => {
    const hasSeenWizard = localStorage.getItem('sellora_pos_wizard_seen') || localStorage.getItem('mamajusto_pos_wizard_seen');
    if (!hasSeenWizard) {
      setIsSetupWizardOpen(true);
      localStorage.setItem('sellora_pos_wizard_seen', 'true');
    }
  }, []);

  // Compute tenant subscription state
  const { status: calculatedStatus } = computeSubscriptionStatus(currentTenant);
  const effectiveStatus =
    currentTenant.status === 'SUSPENDED' || currentTenant.status === 'TERMINATED'
      ? currentTenant.status
      : calculatedStatus;

  const isBlocked =
    effectiveStatus === 'EXPIRED' ||
    effectiveStatus === 'SUSPENDED' ||
    effectiveStatus === 'TERMINATED';

  // 1. Super Admin Full-Screen Dashboard
  if (isSuperAdminOpen) {
    return (
      <>
        <SuperAdminDashboard
          onExitAdmin={() => setIsSuperAdminOpen(false)}
          onSelectShopToView={(tenantId) => {
            switchTenant(tenantId);
            setIsSuperAdminOpen(false);
          }}
        />
        <ToastContainer />
      </>
    );
  }

  // 2. Subscription Lockout Guard
  if (isBlocked) {
    return (
      <>
        <SubscriptionBlockedScreen
          tenant={currentTenant}
          onSuperAdminAuthenticated={() => {
            setIsSuperAdmin(true);
            setIsSuperAdminOpen(true);
          }}
          onSwitchTenant={() => setIsShopSwitcherOpen(true)}
          onRefreshStatus={refreshSubscriptionStatus}
        />
        <ShopSwitcherModal
          isOpen={isShopSwitcherOpen}
          onClose={() => setIsShopSwitcherOpen(false)}
          onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
        />
        <ToastContainer />
      </>
    );
  }

  // True for brand-new installs (adminPasswordChanged defaults to false)
  // AND for existing installs from before this fix, which never had this
  // flag at all but may still be sitting on the literal default PIN.
  const stillUsingDefaultPin =
    profile.adminPasswordChanged !== true && (profile.adminPassword || 'admin123') === 'admin123';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F1F5F9] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Forces a one-time PIN change away from the shipped default -
          see SetAdminPasswordModal for why this exists. */}
      {stillUsingDefaultPin && <SetAdminPasswordModal />}

      {/* Signature Professional Polish Aside Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenShopSwitcher={() => setIsShopSwitcherOpen(true)}
        onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
        onOpenBusinessTypeModal={() => setIsBusinessTypeModalOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <Header
          title={TAB_TITLES[activeTab]}
          onOpenNewSale={() => {
            setInitialSaleService(undefined);
            setActiveTab('sale');
          }}
          onOpenDocRequest={() => setIsDocRequestOpen(true)}
          onOpenShopSwitcher={() => setIsShopSwitcherOpen(true)}
          onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
          onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
          onOpenBusinessTypeModal={() => setIsBusinessTypeModalOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Scrollable Main Content Viewport */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Subscription Expiry Alert Banner */}
          <SubscriptionExpiryBanner
            tenant={currentTenant}
            onRenewClick={() => setIsSuperAdminOpen(true)}
          />

          {/* Low Stock Urgent Warning Banner */}
          <LowStockBanner onNavigateToStock={() => setActiveTab('stock')} />

          {/* Dynamic Tab Router */}
          {activeTab === 'dashboard' && (
            businessMode === 'cyber' ? (
              <DashboardView
                onQuickServiceSelect={(s) => {
                  setInitialSaleService(s);
                  setActiveTab('sale');
                }}
                onOpenNewSale={() => setActiveTab('sale')}
                onOpenDocRequest={() => setIsDocRequestOpen(true)}
                onSelectTransaction={(tx) => setSelectedReceipt(tx)}
              />
            ) : businessMode === 'gas' ? (
              <GasView />
            ) : businessMode === 'electronics' ? (
              <ElectronicsView />
            ) : (
              <GeneralDashboardView onNavigateTab={setActiveTab} />
            )
          )}

          {activeTab === 'sale' && (
            businessMode === 'cyber' ? (
              <SaleView
                initialService={initialSaleService}
                onSaleCompleted={(tx) => setSelectedReceipt(tx)}
              />
            ) : (
              <GeneralSaleView />
            )
          )}

          {activeTab === 'gas' && <GasView />}
          {activeTab === 'electronics' && <ElectronicsView />}

          {activeTab === 'general_products' && <GeneralProductsView />}

          {activeTab === 'transactions' && (
            <TransactionsView onOpenReceipt={(tx) => setSelectedReceipt(tx)} />
          )}

          {activeTab === 'stock' && (
            businessMode === 'cyber' ? <StockView /> : <GeneralStockView />
          )}

          {activeTab === 'general_purchases' && <GeneralPurchasesView />}
          {activeTab === 'general_categories' && <GeneralCategoriesView />}
          {activeTab === 'general_suppliers' && <GeneralSuppliersView />}
          {activeTab === 'general_profit' && <GeneralProfitView />}

          {activeTab === 'services' && <ServicesView />}

          {activeTab === 'debts' && <DebtsView />}

          {activeTab === 'expenses' && <ExpensesView />}

          {activeTab === 'customers' && <CustomersView />}

          {activeTab === 'advertising' && <AdvertisingView />}

          {activeTab === 'family' && <FamilyFinanceView />}

          {activeTab === 'reports' && (
            <ReportsView onOpenReceipt={(tx) => setSelectedReceipt(tx)} />
          )}

          {activeTab === 'staff' && <StaffView />}

          {activeTab === 'settings' && <SettingsView />}

          {activeTab === 'ai' && <AIAssistantView />}
        </main>

        {/* Signature Professional Polish Footer */}
        <footer className="h-12 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 text-[11px] text-slate-400 font-medium z-10">
          <div className="flex items-center gap-2 truncate">
            <span className="truncate">
              {profile.name || currentTenant.shopName || 'Sellora POS'} — Commercial License:{' '}
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                Active ({currentTenant.plan || profile.plan || 'PRO'})
              </span>
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setIsBusinessTypeModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
              title="Change POS business trade and plan"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Change POS Plan</span>
            </button>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => setIsSuperAdminOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 font-bold text-blue-600 dark:text-blue-400 transition-colors"
              title="Open Platform Super Admin Console"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Super Admin Portal</span>
            </button>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => setIsSupabaseOpen(true)}
              className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
              title="Configure Supabase Cloud Database"
            >
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>Cloud: {isSupabaseActive ? 'Supabase Connected' : 'Local / Offline'}</span>
            </button>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              System Status: <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> <span className="text-emerald-500 font-semibold">Online</span>
            </span>
            <span className="hidden md:inline text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => setIsSetupWizardOpen(true)}
              className="hover:text-blue-600 dark:hover:text-blue-400 font-medium flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Setup Wizard</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="font-mono text-[10px] text-slate-500">{currentShop.name}</span>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <ReceiptModal
        transaction={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      <DocRequestModal
        isOpen={isDocRequestOpen}
        onClose={() => setIsDocRequestOpen(false)}
      />

      <ShopSwitcherModal
        isOpen={isShopSwitcherOpen}
        onClose={() => setIsShopSwitcherOpen(false)}
        onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
      />

      <SetupWizardModal
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
      />

      <BusinessTypeSelectionModal
        isOpen={isBusinessTypeModalOpen}
        onClose={() => setIsBusinessTypeModalOpen(false)}
      />

      <SupabaseModal
        isOpen={isSupabaseOpen}
        onClose={() => setIsSupabaseOpen(false)}
      />

      {/* Toast Notification Container */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <POSProvider>
      <MainApp />
    </POSProvider>
  );
}
