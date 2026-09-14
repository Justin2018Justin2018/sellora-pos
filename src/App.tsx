import React, { useState, useEffect } from 'react';
import { POSProvider, usePOS } from './context/POSContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGate } from './components/auth/AuthGate';
import { SyncStatusWidget } from './components/common/SyncStatusWidget';
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
import { NoActiveBusinessScreen } from './components/subscription/NoActiveBusinessScreen';
import { SubscriptionExpiryBanner } from './components/subscription/SubscriptionExpiryBanner';
import { BusinessTypeSelectionModal } from './components/subscription/BusinessTypeSelectionModal';
import { computeSubscriptionStatus } from './services/saasService';
import { getBusinessTypeConfig } from './data/businessTypes';

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
import { Sparkles, ShieldCheck, Database, LogOut } from 'lucide-react';

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
    activeBusinessTypes,
    isSupabaseActive,
    currentTenant,
    switchTenant,
    isSuperAdmin,
    setIsSuperAdmin,
    refreshSubscriptionStatus,
  } = usePOS();
  const { configured: authConfigured, userEmail, dbTenant, signOut } = useAuth();

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

  // Whenever the active business changes, always land back on the
  // dashboard. Without this, a tab that only makes sense for the
  // previous business (e.g. staying on "gas" after switching into
  // Cyber) would keep rendering against the new businessMode's state -
  // at best confusing, at worst showing the wrong business's view. See
  // the tab-router guards below for the corresponding data-side fix.
  useEffect(() => {
    setActiveTab('dashboard');
  }, [businessMode]);

  // Check if first time setup is needed
  useEffect(() => {
    const hasSeenWizard = localStorage.getItem('sellora_pos_wizard_seen') || localStorage.getItem('mamajusto_pos_wizard_seen');
    if (!hasSeenWizard) {
      setIsSetupWizardOpen(true);
      localStorage.setItem('sellora_pos_wizard_seen', 'true');
    }
  }, []);

  // Compute tenant subscription state. Prefer the record pulled straight
  // from Supabase (dbTenant) - it can't be edited from devtools the way
  // the local currentTenant copy can. Falls back to the local copy for
  // shops that don't have a database row yet (e.g. local-only demo
  // tenants), so existing behavior is preserved until they're migrated.
  const authoritativeTenant = dbTenant || currentTenant;
  const { status: calculatedStatus } = computeSubscriptionStatus(authoritativeTenant);
  const effectiveStatus =
    authoritativeTenant.status === 'SUSPENDED' || authoritativeTenant.status === 'TERMINATED'
      ? authoritativeTenant.status
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
          tenant={authoritativeTenant}
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

  // 3. No Active Business Guard
  // The account itself is fine, but every business subscription has
  // expired/been cancelled - there is nothing to switch into. Distinct
  // from isBlocked above (whole-account suspension/expiry).
  if (activeBusinessTypes.length === 0) {
    return (
      <>
        <NoActiveBusinessScreen
          tenant={authoritativeTenant}
          onSubscribe={() => setIsBusinessTypeModalOpen(true)}
          onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
        />
        <BusinessTypeSelectionModal
          isOpen={isBusinessTypeModalOpen}
          onClose={() => setIsBusinessTypeModalOpen(false)}
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
            tenant={authoritativeTenant}
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
              <ElectronicsView onSaleCompleted={(tx) => setSelectedReceipt(tx)} />
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

          {/* Gas/Electronics render their OWN dedicated data (gasTransactions,
              electronicsProducts, ...) regardless of what activeTab says, so
              this must also check businessMode - otherwise a stale activeTab
              (e.g. right after switching business, or a forced/devtools tab
              change) could show one business's full data while a different
              business is actually active. The activeTab-reset effect above
              covers normal navigation; this is the render-time backstop. */}
          {activeTab === 'gas' && businessMode === 'gas' && <GasView />}
          {activeTab === 'electronics' && businessMode === 'electronics' && (
            <ElectronicsView onSaleCompleted={(tx) => setSelectedReceipt(tx)} />
          )}

          {activeTab === 'general_products' && <GeneralProductsView />}

          {/* TransactionsView reads the cyber-only `transactions` state
              directly, so it must not render for other businesses -
              otherwise Gas/Electronics/Shop would show Cyber's sales.
              Non-cyber businesses already have their own correctly
              business-scoped sales via `generalSales` (see
              GeneralDashboardView/GeneralProfitView) - a dedicated
              full history list for them is a follow-up, not yet built. */}
          {activeTab === 'transactions' && (
            businessMode === 'cyber' ? (
              <TransactionsView onOpenReceipt={(tx) => setSelectedReceipt(tx)} />
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Sales history for {getBusinessTypeConfig(businessMode).shortName} appears on its Dashboard and
                Profit Analysis tabs.
              </div>
            )
          )}

          {activeTab === 'stock' && (
            businessMode === 'cyber' ? <StockView /> : <GeneralStockView />
          )}

          {activeTab === 'general_purchases' && <GeneralPurchasesView />}
          {activeTab === 'general_categories' && <GeneralCategoriesView />}
          {activeTab === 'general_suppliers' && <GeneralSuppliersView />}
          {activeTab === 'general_profit' && <GeneralProfitView />}

          {activeTab === 'services' && businessMode === 'cyber' && <ServicesView />}

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
              {profile.name || authoritativeTenant.shopName || 'Sellora POS'} — Commercial License:{' '}
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                Active ({authoritativeTenant.plan || profile.plan || 'PRO'})
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
            {authConfigured && userEmail && (
              <>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  onClick={() => {
                    if (window.confirm('Sign out of this shop account?')) {
                      signOut();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 hover:text-red-600 dark:hover:text-red-400 font-medium transition-colors"
                  title={`Signed in as ${userEmail}`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{userEmail}</span>
                  <span className="md:hidden">Sign out</span>
                </button>
              </>
            )}
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

      {/* Offline/Sync Status - see services/offlineDb.ts, connectivity.ts, syncEngine.ts */}
      <SyncStatusWidget />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <POSProvider>
          <MainApp />
        </POSProvider>
      </AuthGate>
    </AuthProvider>
  );
}
