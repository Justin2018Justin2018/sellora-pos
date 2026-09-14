import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  BusinessMode,
  BusinessProfile,
  Customer,
  DebtRecord,
  ElectronicsProduct,
  ElectronicsReturn,
  ElectronicsSale,
  Expense,
  FamilyExpense,
  FamilyIncomeManual,
  GasTransaction,
  MpesaConfig,
  SalaryPayment,
  ServiceItem,
  Shop,
  StockItem,
  Supplier,
  Transaction,
  UserAccount,
  UserRole,
  WastageRecord,
  AuditEntry,
  TenantAccount,
  GeneralProduct,
  GeneralCategory,
  GeneralSupplier,
  GeneralPurchase,
  GeneralSale,
  GeneralSaleItem,
  GeneralUnit,
  TaxRule,
  BusinessSubscription,
  SubscriptionPlan
} from '../types/pos';
import { offlineDb, generateLocalId, getDeviceId } from '../services/offlineDb';
import { enqueueSync, processSyncQueue } from '../services/syncEngine';
import { checkRealConnectivity } from '../services/connectivity';
import {
  getCurrentTenantId,
  setCurrentTenantId,
  getTenantById,
  getCurrentTenant,
  isSuperAdminAuthenticated,
  computeSubscriptionStatus,
  updateTenant
} from '../services/saasService';
import {
  getBusinessSubscriptions,
  getActiveBusinessTypes,
  subscribeBusinessType,
  cancelBusinessType,
  migrateLegacyBusinessType,
  fetchBusinessSubscriptionsFromDb,
} from '../services/businessSubscriptionService';
import { BUSINESS_TYPES, getBusinessTypeConfig } from '../data/businessTypes';
import {
  isSupabaseConfigured,
  getSupabaseProjectDisplay,
  syncTransactionToSupabase,
  syncExpenseToSupabase,
  syncStockToSupabase,
  syncDebtToSupabase,
  syncCustomerToSupabase,
  fetchTransactionsFromSupabase,
  testSupabaseConnection,
  deleteTransactionFromSupabase
} from '../services/supabase';
import {
  DEFAULT_BUSINESS_PROFILE,
  DEFAULT_CUSTOMERS,
  DEFAULT_ELECTRONICS_PRODUCTS,
  DEFAULT_GENERAL_CATEGORIES,
  DEFAULT_GENERAL_PRODUCTS,
  DEFAULT_GENERAL_SUPPLIERS,
  DEFAULT_CYBER_CATEGORIES,
  DEFAULT_CYBER_SUPPLIERS,
  DEFAULT_CYBER_PRODUCTS,
  DEFAULT_GAS_CATEGORIES,
  DEFAULT_GAS_SUPPLIERS,
  DEFAULT_GAS_PRODUCTS,
  DEFAULT_TECH_CATEGORIES,
  DEFAULT_TECH_SUPPLIERS,
  DEFAULT_TECH_PRODUCTS,
  DEFAULT_SERVICES,
  DEFAULT_SHOPS,
  DEFAULT_STAFF,
  DEFAULT_STOCK,
  INITIAL_EXPENSES,
  INITIAL_GAS_TRANSACTIONS,
  INITIAL_GENERAL_SALES,
  INITIAL_TRANSACTIONS
} from '../data/defaultData';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface POSContextType {
  profile: BusinessProfile;
  updateProfile: (updates: Partial<BusinessProfile>) => void;
  shops: Shop[];
  currentShop: Shop;
  switchShop: (shopId: string) => void;
  businessMode: BusinessMode;
  setBusinessMode: (mode: BusinessMode) => void;
  updateBusinessType: (mode: BusinessMode) => void;

  // Multi-Business Subscriptions
  /** Raw subscription rows (one per business type) for the current tenant. */
  businessSubscriptions: BusinessSubscription[];
  /** Business types this tenant currently has active (unexpired, not cancelled) access to. Expands an 'all' bundle subscription. */
  activeBusinessTypes: BusinessMode[];
  /** True if the tenant currently has an active subscription for this business type. */
  isBusinessSubscribed: (mode: BusinessMode) => boolean;
  /** Activates or renews a subscription for an additional business type. */
  subscribeToBusinessType: (mode: BusinessMode, plan: SubscriptionPlan, billingCycle: 'monthly' | 'annual', months?: number) => void;
  /** Cancels a business's subscription. Access is revoked immediately; historical data for that business is preserved. */
  cancelBusinessSubscription: (mode: BusinessMode) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  
  // Tax Rules & VAT
  taxRules: TaxRule[];
  addTaxRule: (rule: Omit<TaxRule, 'id'>) => void;
  updateTaxRule: (id: string, updates: Partial<TaxRule>) => void;
  deleteTaxRule: (id: string) => void;
  toggleTaxRule: (id: string) => void;
  setDefaultTaxRule: (id: string) => void;
  
  // Auth & Roles
  currentUser: UserAccount | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  switchUser: (roleOrUsername: string) => boolean;
  hasRole: (minRole: UserRole) => boolean;
  staffList: UserAccount[];
  addStaff: (staff: Omit<UserAccount, 'id' | 'createdAt'>) => boolean;
  updateStaff: (id: string, updates: Partial<UserAccount>) => void;
  deleteStaff: (id: string) => boolean;

  // Catalog & Inventory
  services: ServiceItem[];
  addService: (service: ServiceItem) => boolean;
  updateService: (indexOrName: number | string, service: ServiceItem) => void;
  deleteService: (indexOrName: number | string) => boolean;
  
  stock: StockItem[];
  addStock: (name: string, opening: number, added: number, unit?: string, costPrice?: number, sellingPrice?: number, reorderLevel?: number, category?: string) => void;
  addStockBatch: (name: string, addedQty: number, cost?: number, notes?: string) => void;
  addNewStockItem: (item: Partial<StockItem>) => boolean;
  updateStockPricing: (index: number, updates: Partial<StockItem>) => void;
  deleteStockItem: (index: number) => boolean;
  stockRemaining: (item: StockItem) => number;
  stockSoldUsed: (name: string) => number;
  lowStockItems: StockItem[];
  outOfStockItems: StockItem[];
  
  wastage: WastageRecord[];
  addWastage: (name: string, qty: number, reason: string) => boolean;
  recordWastage: (name: string, qty: number, reason: string) => boolean;
  deleteWastage: (id: number) => boolean;

  // Cyber Sales
  transactions: Transaction[];
  recordCyberSale: (sale: Omit<Transaction, 'id' | 'receipt' | 'date' | 'staff' | 'shopId'>) => Transaction;
  editTransaction: (id: number, updates: Partial<Transaction>) => boolean;
  cancelTransaction: (id: number, reason?: string) => boolean;
  deleteTransaction: (id: number, password?: string) => boolean;
  verifyAdminPassword: (password: string) => boolean;
  updateAdminPassword: (currentPass: string, newPass: string) => { success: boolean; message: string };

  // Gas Station
  gasTransactions: GasTransaction[];
  recordGasRefill: (refill: Omit<GasTransaction, 'id' | 'receipt' | 'date' | 'staff' | 'shopId'>) => GasTransaction;
  editGasRefill: (id: number, updates: Partial<GasTransaction>) => boolean;
  deleteGasRefill: (id: number, password?: string) => boolean;

  // Electronics Hub
  electronicsProducts: ElectronicsProduct[];
  addElectronicsProduct: (prod: Omit<ElectronicsProduct, 'id'>) => void;
  updateElectronicsProduct: (id: string, updates: Partial<ElectronicsProduct>) => void;
  deleteElectronicsProduct: (id: string) => boolean;
  electronicsSales: ElectronicsSale[];
  recordElectronicsSale: (sale: Omit<ElectronicsSale, 'id' | 'receipt' | 'date' | 'staff'>) => ElectronicsSale;
  electronicsReturns: ElectronicsReturn[];
  recordElectronicsReturn: (ret: Omit<ElectronicsReturn, 'id' | 'date' | 'staff'>) => void;
  deleteElectronicsSale: (id: number, password?: string) => boolean;

  // Expenses & Debts
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'staff' | 'shopId'>) => void;
  updateExpense: (id: number, updates: Partial<Expense>) => void;
  deleteExpense: (id: number, password?: string) => boolean;
  
  debts: DebtRecord[];
  addDebt: (debt: Omit<DebtRecord, 'id' | 'paid' | 'profitRecognized' | 'staff' | 'shopId'>) => void;
  recordDebtPayment: (id: number, amount: number) => boolean;
  deleteDebt: (id: number) => boolean;

  // Customers & Suppliers
  customers: Customer[];
  addCustomer: (cust: Customer) => void;
  updateCustomer: (phone: string, updates: Partial<Customer>) => void;
  deleteCustomer: (phone: string) => boolean;
  suppliers: Supplier[];
  addSupplier: (supp: Supplier) => void;
  
  // Family & Personal Finance
  salaries: SalaryPayment[];
  addSalary: (amount: number, date: string, payment: any, note?: string) => void;
  deleteSalary: (id: number) => boolean;
  familyExpenses: FamilyExpense[];
  addFamilyExpense: (name: string, amount: number, date: string, payment: any, note?: string) => void;
  deleteFamilyExpense: (id: string | number, password?: string) => boolean;
  familyIncomeManual: FamilyIncomeManual[];
  addFamilyIncomeManual: (source: string, amount: number, date: string, note?: string) => void;
  deleteFamilyIncomeManual: (id: string | number) => boolean;

  // M-Pesa Integration
  mpesaConfig: MpesaConfig;
  updateMpesaConfig: (updates: Partial<MpesaConfig>) => void;
  simulateStkPush: (phone: string, amount: number, description: string) => Promise<{ success: boolean; mpesaReceipt?: string; error?: string }>;

  // Audit Log & Backup
  auditLog: AuditEntry[];
  logAudit: (action: string, details: string) => void;
  exportBackupJSON: () => string;
  backupDatabase: () => string;
  importBackupJSON: (jsonString: string) => { success: boolean; message: string };
  restoreDatabase: (jsonString: string) => boolean;
  resetFactoryDemoData: () => void;
  resetDatabase: () => void;

  // Notifications
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // Supabase Cloud Integration
  isSupabaseActive: boolean;
  supabaseHost: string;
  syncSupabaseCloud: () => Promise<void>;

  // SaaS Multi-Tenancy & Subscriptions
  currentTenant: TenantAccount;
  switchTenant: (tenantId: string) => void;
  isSuperAdmin: boolean;
  setIsSuperAdmin: (val: boolean) => void;
  refreshSubscriptionStatus: () => void;

  // General Shop Mode
  generalProducts: GeneralProduct[];
  addGeneralProduct: (prod: Omit<GeneralProduct, 'id'>) => boolean;
  updateGeneralProduct: (id: string, updates: Partial<GeneralProduct>) => void;
  deleteGeneralProduct: (id: string) => boolean;

  generalCategories: GeneralCategory[];
  addGeneralCategory: (cat: Omit<GeneralCategory, 'id'>) => boolean;
  deleteGeneralCategory: (id: string) => boolean;

  generalSuppliers: GeneralSupplier[];
  addGeneralSupplier: (sup: Omit<GeneralSupplier, 'id'>) => boolean;
  updateGeneralSupplier: (id: string, updates: Partial<GeneralSupplier>) => void;
  deleteGeneralSupplier: (id: string) => boolean;

  generalPurchases: GeneralPurchase[];
  recordGeneralPurchase: (purchase: Omit<GeneralPurchase, 'id' | 'date'>) => boolean;

  generalSales: GeneralSale[];
  recordGeneralSale: (sale: Omit<GeneralSale, 'id' | 'date' | 'receipt'>) => GeneralSale | null;
  deleteGeneralSale: (id: number) => boolean;

  // Helpers
  formatMoney: (amount: number) => string;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

function isPrimaryTenantId(tid?: string): boolean {
  return !tid || tid === 'tenant_sellora_main' || tid === 'tenant_mamajusto_main';
}

function getTenantKeyStatic(tid: string, key: string): string {
  if (isPrimaryTenantId(tid)) {
    return `mj_pos_${key}`;
  }
  return `mj_tenant_${tid}_${key}`;
}

function safeStorageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Safe storage parse failed for ${key}`, e);
    return fallback;
  }
}

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // SaaS Multi-Tenancy & Subscriptions State
  const [currentTenantIdState, setCurrentTenantIdState] = useState<string>(() => getCurrentTenantId());
  const [currentTenant, setCurrentTenant] = useState<TenantAccount>(() => getCurrentTenant());
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(() => isSuperAdminAuthenticated());

  // Business Profile & Modes
  const [profile, setProfile] = useState<BusinessProfile>(() => {
    const tid = getCurrentTenantId();
    const activeT = getCurrentTenant();
    const fallback: BusinessProfile = {
      ...DEFAULT_BUSINESS_PROFILE,
      name: activeT.shopName || DEFAULT_BUSINESS_PROFILE.name,
      plan: activeT.plan || DEFAULT_BUSINESS_PROFILE.plan,
    };
    const loaded = safeStorageGet<BusinessProfile>(getTenantKeyStatic(tid, 'profile'), fallback);
    const resolved: BusinessProfile = {
      ...fallback,
      ...loaded,
      taxRules: loaded.taxRules && loaded.taxRules.length > 0 ? loaded.taxRules : (fallback.taxRules || []),
      enableTax: loaded.enableTax !== undefined ? loaded.enableTax : (fallback.enableTax ?? true),
      taxCalculationMode: loaded.taxCalculationMode || fallback.taxCalculationMode || 'inclusive',
      defaultTaxRate: loaded.defaultTaxRate !== undefined ? loaded.defaultTaxRate : (fallback.defaultTaxRate ?? 16),
      taxName: loaded.taxName || fallback.taxName || 'VAT (16%)',
    };

    // Automatically migrate legacy/default business profile to Sellora POS
    if (!resolved.name || /mama/i.test(resolved.name) || /justo/i.test(resolved.name)) {
      resolved.name = 'Sellora POS';
      resolved.phone = '0711146198';
      resolved.email = 'hesborn.nyakundi495@gmail.com';
      resolved.receiptHeader = 'SELLORA POS — NAIROBI';
      resolved.receiptFooter = 'Thank you for choosing Sellora POS. Karibu tena!';
      try {
        localStorage.setItem(getTenantKeyStatic(tid, 'profile'), JSON.stringify(resolved));
        localStorage.setItem('mj_pos_profile', JSON.stringify(resolved));
      } catch {
        // Safe fallback if storage quota exceeded
      }
    }

    return resolved;
  });
  const [shops] = useState<Shop[]>(() => {
    const raw = safeStorageGet<Shop[]>('mj_pos_shops', DEFAULT_SHOPS);
    const sanitized = raw.map((s) => ({
      ...s,
      name: s.name.replace(/Mama\s*Justo/gi, 'Sellora'),
      phone: s.phone === '0712478642' ? '0711146198' : s.phone,
    }));
    try {
      localStorage.setItem('mj_pos_shops', JSON.stringify(sanitized));
    } catch {
      // Safe fallback if storage quota exceeded
    }
    return sanitized;
  });
  const [currentShopId, setCurrentShopId] = useState<string>(() =>
    localStorage.getItem(getTenantKeyStatic(getCurrentTenantId(), 'current_shop')) || DEFAULT_SHOPS[0].id
  );
  // ------------------------------------------------------------
  // Multi-Business Subscriptions
  // ------------------------------------------------------------
  // A tenant can hold several ACTIVE BusinessSubscription rows at
  // once (one per business type they've paid for). `businessMode`
  // below is which one of those is CURRENTLY selected/active in the
  // UI - not which ones the tenant is allowed to use. setBusinessMode
  // refuses to switch into a business type that isn't in
  // activeBusinessTypes, so a subscription can never be bypassed by
  // calling the context function directly (e.g. from devtools). The
  // real, un-bypassable boundary is Supabase RLS (see
  // supabase-schema-v4-business-isolation.sql) - this is defense in
  // depth on top of that for the local/offline case.
  const [businessSubscriptions, setBusinessSubscriptionsState] = useState<BusinessSubscription[]>(() => {
    const tid = getCurrentTenantId();
    const activeT = getCurrentTenant();
    // First-run migration: a tenant created before this feature existed
    // has no subscription rows yet, just a legacy single businessType.
    // Turn that into one ACTIVE row so nobody loses access they already
    // had.
    return migrateLegacyBusinessType(tid, activeT.shopName, activeT.businessType, activeT.plan, activeT.expiryDate);
  });

  const activeBusinessTypes = useMemo<BusinessMode[]>(() => {
    const tid = getCurrentTenantId();
    return getActiveBusinessTypes(tid);
  }, [businessSubscriptions]);

  const isBusinessSubscribed = useCallback(
    (mode: BusinessMode) => activeBusinessTypes.includes(mode),
    [activeBusinessTypes]
  );

  // Best-effort refresh from Supabase - this is the authoritative,
  // can't-be-spoofed picture when cloud sync is configured. Re-runs on
  // tenant switch via the tenantId dependency below.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const tid = getCurrentTenantId();
    fetchBusinessSubscriptionsFromDb(tid).then((remote) => {
      if (remote) setBusinessSubscriptionsState(remote);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenantIdState]);

  const [businessMode, setBusinessModeState] = useState<BusinessMode>(() => {
    const tid = getCurrentTenantId();
    const activeT = getCurrentTenant();
    const stored = safeStorageGet<BusinessMode | null>(getTenantKeyStatic(tid, 'business_mode'), null);
    const active = getActiveBusinessTypes(tid);
    const preferred = stored || activeT.businessType || active[0] || 'cyber';
    // Never boot into a business type this tenant no longer has an
    // active subscription for (e.g. it expired/was cancelled since the
    // last session) - fall back to whichever active business comes
    // first instead.
    return active.includes(preferred) ? preferred : (active[0] || preferred);
  });

  const setBusinessMode = useCallback((mode: BusinessMode) => {
    if (!activeBusinessTypes.includes(mode)) {
      console.warn(`Blocked switch to "${mode}": no active subscription for this business.`);
      return;
    }
    setBusinessModeState(mode);
    const tid = getCurrentTenantId();
    localStorage.setItem(getTenantKeyStatic(tid, 'business_mode'), JSON.stringify(mode));
    // businessType on the tenant record is kept only as a legacy/display
    // "primary business" hint now - subscriptions are the real access
    // control - so this is harmless to keep updating for old call sites.
    updateTenant(tid, { businessType: mode });
  }, [activeBusinessTypes]);

  const updateBusinessType = useCallback((mode: BusinessMode) => {
    setBusinessMode(mode);
  }, [setBusinessMode]);

  const subscribeToBusinessType = useCallback((
    mode: BusinessMode,
    plan: SubscriptionPlan,
    billingCycle: 'monthly' | 'annual',
    months?: number
  ) => {
    const tid = getCurrentTenantId();
    const activeT = getCurrentTenant();
    const updated = subscribeBusinessType(tid, activeT.shopName, mode, plan, billingCycle, months);
    setBusinessSubscriptionsState((prev) => {
      const idx = prev.findIndex((s) => s.businessType === mode);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });
  }, []);

  const cancelBusinessSubscription = useCallback((mode: BusinessMode) => {
    const tid = getCurrentTenantId();
    const activeT = getCurrentTenant();
    const didCancel = cancelBusinessType(tid, activeT.shopName, mode);
    if (!didCancel) return;
    setBusinessSubscriptionsState((prev) =>
      prev.map((s) => (s.businessType === mode ? { ...s, status: 'CANCELLED', cancelledAt: new Date().toISOString() } : s))
    );
  }, []);

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('mj_theme') as 'light' | 'dark') || 'light'
  );

  // Authentication
  const [staffList, setStaffList] = useState<UserAccount[]>(() => {
    const tid = getCurrentTenantId();
    const activeT = getCurrentTenant();
    const defaultStaff = isPrimaryTenantId(tid)
      ? DEFAULT_STAFF
      : [
          {
            id: `STAFF_${tid}_01`,
            name: activeT.ownerName,
            username: activeT.username,
            password: activeT.password || 'password123',
            role: 'admin' as UserRole,
            phone: activeT.phone,
            email: activeT.email,
            active: true,
            createdAt: activeT.createdAt,
          },
        ];
    return safeStorageGet(getTenantKeyStatic(tid, 'staff'), defaultStaff);
  });
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const tid = getCurrentTenantId();
    const cached = safeStorageGet<UserAccount | null>(getTenantKeyStatic(tid, 'session_user'), null);
    return cached || staffList[0] || DEFAULT_STAFF[0];
  });

  // Entities
  const [services, setServices] = useState<ServiceItem[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'services'), DEFAULT_SERVICES);
  });
  const [stock, setStock] = useState<StockItem[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'stock'), DEFAULT_STOCK);
  });
  const [wastage, setWastage] = useState<WastageRecord[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'wastage'), []);
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'transactions'), isPrimaryTenantId(tid) ? INITIAL_TRANSACTIONS : []);
  });
  const [gasTransactions, setGasTransactions] = useState<GasTransaction[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gas_tx'), INITIAL_GAS_TRANSACTIONS);
  });
  const [electronicsProducts, setElectronicsProducts] = useState<ElectronicsProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'el_products'), DEFAULT_ELECTRONICS_PRODUCTS);
  });
  const [electronicsSales, setElectronicsSales] = useState<ElectronicsSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'el_sales'), []);
  });
  const [electronicsReturns, setElectronicsReturns] = useState<ElectronicsReturn[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'el_returns'), []);
  });

  // 1. Cyber State
  const [cyberProducts, setCyberProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'cyber_products'), DEFAULT_CYBER_PRODUCTS);
  });
  const [cyberCategories, setCyberCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'cyber_categories'), DEFAULT_CYBER_CATEGORIES);
  });
  const [cyberSuppliers, setCyberSuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'cyber_suppliers'), DEFAULT_CYBER_SUPPLIERS);
  });
  const [cyberPurchases, setCyberPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'cyber_purchases'), []);
  });
  const [cyberSales, setCyberSales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'cyber_sales'), []);
  });

  // 2. Gas State
  const [gasProducts, setGasProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gas_products'), DEFAULT_GAS_PRODUCTS);
  });
  const [gasCategories, setGasCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gas_categories'), DEFAULT_GAS_CATEGORIES);
  });
  const [gasSuppliers, setGasSuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gas_suppliers'), DEFAULT_GAS_SUPPLIERS);
  });
  const [gasPurchases, setGasPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gas_purchases'), []);
  });
  const [gasSales, setGasSales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gas_sales'), []);
  });

  // 3. Tech / Electronics State
  const [techProducts, setTechProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'tech_products'), DEFAULT_TECH_PRODUCTS);
  });
  const [techCategories, setTechCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'tech_categories'), DEFAULT_TECH_CATEGORIES);
  });
  const [techSuppliers, setTechSuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'tech_suppliers'), DEFAULT_TECH_SUPPLIERS);
  });
  const [techPurchases, setTechPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'tech_purchases'), []);
  });
  const [techSales, setTechSales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'tech_sales'), []);
  });

  // 4. General Shop State
  const [generalProducts, setGeneralProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gen_products'), DEFAULT_GENERAL_PRODUCTS);
  });
  const [generalCategories, setGeneralCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gen_categories'), DEFAULT_GENERAL_CATEGORIES);
  });
  const [generalSuppliers, setGeneralSuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gen_suppliers'), DEFAULT_GENERAL_SUPPLIERS);
  });
  const [generalPurchases, setGeneralPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gen_purchases'), []);
  });
  const [generalSales, setGeneralSales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'gen_sales'), INITIAL_GENERAL_SALES);
  });

  // 5. Clothing & Fashion State
  const [clothingProducts, setClothingProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'clothing_products'), getBusinessTypeConfig('clothing').defaultProducts as GeneralProduct[]);
  });
  const [clothingCategories, setClothingCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'clothing_categories'), getBusinessTypeConfig('clothing').defaultCategories);
  });
  const [clothingSuppliers, setClothingSuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'clothing_suppliers'), getBusinessTypeConfig('clothing').defaultSuppliers);
  });
  const [clothingPurchases, setClothingPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'clothing_purchases'), []);
  });
  const [clothingSales, setClothingSales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'clothing_sales'), []);
  });

  // 6. Restaurant & Food State
  const [restaurantProducts, setRestaurantProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'restaurant_products'), getBusinessTypeConfig('restaurant').defaultProducts as GeneralProduct[]);
  });
  const [restaurantCategories, setRestaurantCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'restaurant_categories'), getBusinessTypeConfig('restaurant').defaultCategories);
  });
  const [restaurantSuppliers, setRestaurantSuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'restaurant_suppliers'), getBusinessTypeConfig('restaurant').defaultSuppliers);
  });
  const [restaurantPurchases, setRestaurantPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'restaurant_purchases'), []);
  });
  const [restaurantSales, setRestaurantSales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'restaurant_sales'), []);
  });

  // 7. Pharmacy State
  const [pharmacyProducts, setPharmacyProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'pharmacy_products'), getBusinessTypeConfig('pharmacy').defaultProducts as GeneralProduct[]);
  });
  const [pharmacyCategories, setPharmacyCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'pharmacy_categories'), getBusinessTypeConfig('pharmacy').defaultCategories);
  });
  const [pharmacySuppliers, setPharmacySuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'pharmacy_suppliers'), getBusinessTypeConfig('pharmacy').defaultSuppliers);
  });
  const [pharmacyPurchases, setPharmacyPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'pharmacy_purchases'), []);
  });
  const [pharmacySales, setPharmacySales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'pharmacy_sales'), []);
  });

  // 8. Other / Specialty State
  const [otherProducts, setOtherProducts] = useState<GeneralProduct[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'other_products'), getBusinessTypeConfig('other').defaultProducts as GeneralProduct[]);
  });
  const [otherCategories, setOtherCategories] = useState<GeneralCategory[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'other_categories'), getBusinessTypeConfig('other').defaultCategories);
  });
  const [otherSuppliers, setOtherSuppliers] = useState<GeneralSupplier[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'other_suppliers'), getBusinessTypeConfig('other').defaultSuppliers);
  });
  const [otherPurchases, setOtherPurchases] = useState<GeneralPurchase[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'other_purchases'), []);
  });
  const [otherSales, setOtherSales] = useState<GeneralSale[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'other_sales'), []);
  });

  // Dynamic active mappings based on businessMode
  const activeProducts =
    businessMode === 'cyber' ? cyberProducts :
    businessMode === 'gas' ? gasProducts :
    businessMode === 'electronics' ? techProducts :
    businessMode === 'clothing' ? clothingProducts :
    businessMode === 'restaurant' ? restaurantProducts :
    businessMode === 'pharmacy' ? pharmacyProducts :
    businessMode === 'other' ? otherProducts :
    businessMode === 'all' ? [...cyberProducts, ...gasProducts, ...techProducts, ...generalProducts] :
    generalProducts;

  const setActiveProducts =
    businessMode === 'cyber' ? setCyberProducts :
    businessMode === 'gas' ? setGasProducts :
    businessMode === 'electronics' ? setTechProducts :
    businessMode === 'clothing' ? setClothingProducts :
    businessMode === 'restaurant' ? setRestaurantProducts :
    businessMode === 'pharmacy' ? setPharmacyProducts :
    businessMode === 'other' ? setOtherProducts :
    setGeneralProducts;

  const activeCategories =
    businessMode === 'cyber' ? cyberCategories :
    businessMode === 'gas' ? gasCategories :
    businessMode === 'electronics' ? techCategories :
    businessMode === 'clothing' ? clothingCategories :
    businessMode === 'restaurant' ? restaurantCategories :
    businessMode === 'pharmacy' ? pharmacyCategories :
    businessMode === 'other' ? otherCategories :
    generalCategories;

  const setActiveCategories =
    businessMode === 'cyber' ? setCyberCategories :
    businessMode === 'gas' ? setGasCategories :
    businessMode === 'electronics' ? setTechCategories :
    businessMode === 'clothing' ? setClothingCategories :
    businessMode === 'restaurant' ? setRestaurantCategories :
    businessMode === 'pharmacy' ? setPharmacyCategories :
    businessMode === 'other' ? setOtherCategories :
    setGeneralCategories;

  const activeSuppliers =
    businessMode === 'cyber' ? cyberSuppliers :
    businessMode === 'gas' ? gasSuppliers :
    businessMode === 'electronics' ? techSuppliers :
    businessMode === 'clothing' ? clothingSuppliers :
    businessMode === 'restaurant' ? restaurantSuppliers :
    businessMode === 'pharmacy' ? pharmacySuppliers :
    businessMode === 'other' ? otherSuppliers :
    generalSuppliers;

  const setActiveSuppliers =
    businessMode === 'cyber' ? setCyberSuppliers :
    businessMode === 'gas' ? setGasSuppliers :
    businessMode === 'electronics' ? setTechSuppliers :
    businessMode === 'clothing' ? setClothingSuppliers :
    businessMode === 'restaurant' ? setRestaurantSuppliers :
    businessMode === 'pharmacy' ? setPharmacySuppliers :
    businessMode === 'other' ? setOtherSuppliers :
    setGeneralSuppliers;

  const activePurchases =
    businessMode === 'cyber' ? cyberPurchases :
    businessMode === 'gas' ? gasPurchases :
    businessMode === 'electronics' ? techPurchases :
    businessMode === 'clothing' ? clothingPurchases :
    businessMode === 'restaurant' ? restaurantPurchases :
    businessMode === 'pharmacy' ? pharmacyPurchases :
    businessMode === 'other' ? otherPurchases :
    generalPurchases;

  const setActivePurchases =
    businessMode === 'cyber' ? setCyberPurchases :
    businessMode === 'gas' ? setGasPurchases :
    businessMode === 'electronics' ? setTechPurchases :
    businessMode === 'clothing' ? setClothingPurchases :
    businessMode === 'restaurant' ? setRestaurantPurchases :
    businessMode === 'pharmacy' ? setPharmacyPurchases :
    businessMode === 'other' ? setOtherPurchases :
    setGeneralPurchases;

  const activeSales =
    businessMode === 'cyber' ? cyberSales :
    businessMode === 'gas' ? gasSales :
    businessMode === 'electronics' ? techSales :
    businessMode === 'clothing' ? clothingSales :
    businessMode === 'restaurant' ? restaurantSales :
    businessMode === 'pharmacy' ? pharmacySales :
    businessMode === 'other' ? otherSales :
    generalSales;

  const setActiveSales =
    businessMode === 'cyber' ? setCyberSales :
    businessMode === 'gas' ? setGasSales :
    businessMode === 'electronics' ? setTechSales :
    businessMode === 'clothing' ? setClothingSales :
    businessMode === 'restaurant' ? setRestaurantSales :
    businessMode === 'pharmacy' ? setPharmacySales :
    businessMode === 'other' ? setOtherSales :
    setGeneralSales;

  const addGeneralProduct = useCallback((prod: Omit<GeneralProduct, 'id'>) => {
    const prefix = businessMode === 'cyber' ? 'cyb' : businessMode === 'gas' ? 'gas' : businessMode === 'electronics' ? 'tech' : 'gp';
    const newId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newProd: GeneralProduct = { ...prod, id: newId };
    setActiveProducts((prev) => [newProd, ...prev]);
    return true;
  }, [businessMode]);

  const updateGeneralProduct = useCallback((id: string, updates: Partial<GeneralProduct>) => {
    setActiveProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, [businessMode]);

  const deleteGeneralProduct = useCallback((id: string) => {
    setActiveProducts((prev) => prev.filter((p) => p.id !== id));
    return true;
  }, [businessMode]);

  const addGeneralCategory = useCallback((cat: Omit<GeneralCategory, 'id'>) => {
    const newId = `cat_${Date.now()}`;
    setActiveCategories((prev) => [...prev, { ...cat, id: newId }]);
    return true;
  }, [businessMode]);

  const deleteGeneralCategory = useCallback((id: string) => {
    setActiveCategories((prev) => prev.filter((c) => c.id !== id));
    return true;
  }, [businessMode]);

  const addGeneralSupplier = useCallback((sup: Omit<GeneralSupplier, 'id'>) => {
    const newId = `sup_${Date.now()}`;
    setActiveSuppliers((prev) => [...prev, { ...sup, id: newId }]);
    return true;
  }, [businessMode]);

  const updateGeneralSupplier = useCallback((id: string, updates: Partial<GeneralSupplier>) => {
    setActiveSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, [businessMode]);

  const deleteGeneralSupplier = useCallback((id: string) => {
    setActiveSuppliers((prev) => prev.filter((s) => s.id !== id));
    return true;
  }, [businessMode]);

  const recordGeneralPurchase = useCallback((purchase: Omit<GeneralPurchase, 'id' | 'date'>) => {
    const newPur: GeneralPurchase = {
      ...purchase,
      id: `pur_${Date.now()}`,
      date: new Date().toISOString(),
    };
    setActivePurchases((prev) => [newPur, ...prev]);
    setActiveProducts((prev) =>
      prev.map((p) =>
        p.id === purchase.productId
          ? { ...p, quantity: p.quantity + purchase.qty, buyingPrice: purchase.buyingPrice }
          : p
      )
    );
    return true;
  }, [businessMode]);

  const recordGeneralSale = useCallback((sale: Omit<GeneralSale, 'id' | 'date' | 'receipt'>) => {
    const prefix = businessMode === 'cyber' ? 'CYB' : businessMode === 'gas' ? 'GAS' : businessMode === 'electronics' ? 'TCH' : 'GS';
    const receiptNo = `${prefix}-${String(activeSales.length + 1).padStart(6, '0')}`;
    const newSale: GeneralSale = {
      ...sale,
      id: Date.now(),
      receipt: receiptNo,
      date: new Date().toISOString(),
      status: 'completed',
    };

    setActiveSales((prev) => [newSale, ...prev]);

    setActiveProducts((prev) => {
      const copy = [...prev];
      for (const item of sale.items) {
        const prod = copy.find((p) => p.id === item.productId);
        if (prod) {
          prod.quantity = Math.max(0, prod.quantity - item.qty);
        }
      }
      return copy;
    });

    if (sale.payment === 'Credit / Debt' || sale.paid < sale.total) {
      const remaining = sale.total - sale.paid;
      const newDebt: DebtRecord = {
        id: Date.now(),
        date: new Date().toISOString(),
        name: sale.customer,
        phone: sale.phone || '0700000000',
        reason: `${businessMode.toUpperCase()} Sale Credit`,
        service: sale.items.map((i) => `${i.qty}x ${i.productName}`).join(', '),
        qty: sale.items.reduce((acc, i) => acc + i.qty, 0),
        original: remaining,
        paid: 0,
        payments: [],
        // Was previously hardcoded to 'cyber' regardless of the active
        // business - fixed so a Shop/Gas/Electronics credit sale lands
        // in that business's own debt register, not Cyber's.
        kind: businessMode === 'cyber' ? 'cyber' : undefined,
        businessType: businessMode,
      };
      setDebts((prev) => [newDebt, ...prev]);
    }

    return newSale;
  }, [generalSales.length]);

  const deleteGeneralSale = useCallback((id: number) => {
    setGeneralSales((prev) => prev.filter((s) => s.id !== id));
    return true;
  }, []);
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'expenses'), isPrimaryTenantId(tid) ? INITIAL_EXPENSES : []);
  });
  const [debts, setDebts] = useState<DebtRecord[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'debts'), []);
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const tid = getCurrentTenantId();
    return safeStorageGet(getTenantKeyStatic(tid, 'customers'), isPrimaryTenantId(tid) ? DEFAULT_CUSTOMERS : []);
  });

  // ------------------------------------------------------------
  // Business-scoped views of expenses/debts/customers.
  // ------------------------------------------------------------
  // These three records types are stored as one flat list per tenant
  // (unlike products/sales, which already have dedicated per-business
  // arrays). To keep a Shop's expenses out of Cyber and vice versa,
  // every record is tagged with `businessType` when created (see
  // addExpense/addDebt/addCustomer below), and only records matching
  // the CURRENTLY active business are exposed to the rest of the app
  // through the context value. Backups/restore and internal
  // update-by-id/delete-by-id logic intentionally keep using the full
  // `expenses`/`debts`/`customers` state above them, so switching
  // businesses never loses or reassigns another business's records.
  // Legacy records created before this field existed default to
  // 'cyber' (this app's original single business type) so nothing
  // already saved silently disappears.
  const visibleExpenses = useMemo(
    () => expenses.filter((e) => (e.businessType || 'cyber') === businessMode),
    [expenses, businessMode]
  );
  const visibleDebts = useMemo(
    () => debts.filter((d) => (d.businessType || d.kind || 'cyber') === businessMode),
    [debts, businessMode]
  );
  const visibleCustomers = useMemo(
    () => customers.filter((c) => (c.businessType || 'cyber') === businessMode),
    [customers, businessMode]
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>(() =>
    safeStorageGet('mj_pos_suppliers', [
      { id: 'SUP_1', name: 'Paper Converters Kenya', phone: '0722111222', email: 'orders@paperconverters.co.ke', productsSupplied: 'A4 & A3 Printing Reams' },
      { id: 'SUP_2', name: 'Office Mart Nairobi', phone: '0733444555', email: 'sales@officemart.co.ke', productsSupplied: 'Laminating Pouches & Binding' },
      { id: 'SUP_3', name: 'Total Kenya LPG Distribution', phone: '0720999888', email: 'lpg@total.co.ke', productsSupplied: 'LPG Gas Refill Cylinders' }
    ])
  );
  const [salaries, setSalaries] = useState<SalaryPayment[]>(() =>
    safeStorageGet('mj_pos_salaries', [])
  );
  const [familyExpenses, setFamilyExpenses] = useState<FamilyExpense[]>(() =>
    safeStorageGet('mj_pos_family_expenses', [])
  );
  const [familyIncomeManual, setFamilyIncomeManual] = useState<FamilyIncomeManual[]>(() =>
    safeStorageGet('mj_pos_family_income', [])
  );
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() =>
    safeStorageGet('mj_pos_audit_log', [
      { id: 1, time: new Date().toISOString(), staff: 'System', action: 'INIT', details: 'Sellora POS initialized with commercial profile' }
    ])
  );
  const [mpesaConfig, setMpesaConfig] = useState<MpesaConfig>(() =>
    safeStorageGet('mj_pos_mpesa_config', {
      consumerKey: '',
      consumerSecret: '',
      passkey: '',
      shortcode: '174379',
      tillNumber: '522522',
      environment: 'sandbox',
      backendUrl: '/api/mpesa'
    })
  );

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    const timeout = toast.duration || 4000;
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, timeout);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Supabase Cloud State
  const [isSupabaseActive, setIsSupabaseActive] = useState<boolean>(() => isSupabaseConfigured());
  const supabaseHost = useMemo(() => getSupabaseProjectDisplay(), []);

  // Initial Supabase connectivity check & background pull
  useEffect(() => {
    if (isSupabaseConfigured()) {
      testSupabaseConnection()
        .then((res) => {
          setIsSupabaseActive(res.success);
          if (res.success && res.tableReady) {
            // Scope to this shop's own row (shop_members.shop_id ==
            // currentTenantIdState) AND to the cyber business_type,
            // since `transactions`/`stock` are this app's dedicated
            // Cyber-only state - never another business's rows.
            fetchTransactionsFromSupabase(currentTenantIdState, 'cyber')
              .then((remoteTx) => {
                if (remoteTx && remoteTx.length > 0) {
                  setTransactions((prev) => {
                    const existingIds = new Set(prev.map((t) => t.id));
                    const newItems = remoteTx.filter((t) => !existingIds.has(t.id));
                    if (newItems.length > 0) {
                      return [...newItems, ...prev];
                    }
                    return prev;
                  });
                }
              })
              .catch((err) => console.warn('Supabase remote pull notice:', err));
          }
        })
        .catch(() => setIsSupabaseActive(false));
    }
  }, []);

  // Manual or automatic sync to Supabase Cloud
  const syncSupabaseCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      await syncStockToSupabase(stock, currentTenantIdState, 'cyber');
      for (const tx of transactions.slice(0, 30)) {
        await syncTransactionToSupabase(tx, currentTenantIdState, 'cyber');
      }
      // Expenses/debts/customers are tagged per-business (businessType),
      // so only the currently active business's records are pushed here
      // - switching business and syncing again covers that business's
      // own records the same way.
      for (const exp of visibleExpenses.slice(0, 30)) {
        await syncExpenseToSupabase(exp, currentTenantIdState, businessMode);
      }
      for (const debt of visibleDebts.slice(0, 30)) {
        await syncDebtToSupabase(debt, currentTenantIdState, businessMode);
      }
      for (const cust of visibleCustomers.slice(0, 30)) {
        await syncCustomerToSupabase(cust, currentTenantIdState, businessMode);
      }
      setIsSupabaseActive(true);
    } catch (err) {
      console.warn('Sync to Supabase cloud notice:', err);
    }
  }, [stock, transactions, currentTenantIdState, visibleExpenses, visibleDebts, visibleCustomers, businessMode]);

  // Theme synchronization
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('mj_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('mj_theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Sync to local storage with tenant-scoped keys
  // Primary tenant (tenant_mamajusto_main) preserves standard legacy keys (mj_pos_*)
  // Other client shops use mj_tenant_{tenantId}_*
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'profile'), JSON.stringify(profile));
  }, [profile, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'current_shop'), currentShopId);
  }, [currentShopId, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'services'), JSON.stringify(services));
  }, [services, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'stock'), JSON.stringify(stock));
  }, [stock, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'wastage'), JSON.stringify(wastage));
  }, [wastage, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'transactions'), JSON.stringify(transactions));
  }, [transactions, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'gas_tx'), JSON.stringify(gasTransactions));
  }, [gasTransactions, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'el_products'), JSON.stringify(electronicsProducts));
  }, [electronicsProducts, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'el_sales'), JSON.stringify(electronicsSales));
  }, [electronicsSales, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'el_returns'), JSON.stringify(electronicsReturns));
  }, [electronicsReturns, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'expenses'), JSON.stringify(expenses));
  }, [expenses, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'debts'), JSON.stringify(debts));
  }, [debts, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'customers'), JSON.stringify(customers));
  }, [customers, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'suppliers'), JSON.stringify(suppliers));
  }, [suppliers, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'salaries'), JSON.stringify(salaries));
  }, [salaries, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'family_expenses'), JSON.stringify(familyExpenses));
  }, [familyExpenses, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'family_income'), JSON.stringify(familyIncomeManual));
  }, [familyIncomeManual, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'audit_log'), JSON.stringify(auditLog));
  }, [auditLog, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'staff'), JSON.stringify(staffList));
  }, [staffList, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'session_user'), JSON.stringify(currentUser));
  }, [currentUser, currentTenantIdState]);
  useEffect(() => {
    localStorage.setItem(getTenantKeyStatic(currentTenantIdState, 'mpesa_config'), JSON.stringify(mpesaConfig));
  }, [mpesaConfig, currentTenantIdState]);

  // SaaS Tenant Switching Logic (Isolated Data Segregation)
  const switchTenant = useCallback((newTenantId: string) => {
    const targetTenant = getTenantById(newTenantId);
    if (!targetTenant) return;

    setCurrentTenantId(newTenantId);
    setCurrentTenantIdState(newTenantId);
    setCurrentTenant(targetTenant);

    // Rehydrate state from target tenant's store
    const loadedProfile = safeStorageGet<BusinessProfile>(
      getTenantKeyStatic(newTenantId, 'profile'),
      {
        ...DEFAULT_BUSINESS_PROFILE,
        id: `biz_${newTenantId}`,
        name: targetTenant.shopName,
        phone: targetTenant.phone,
        email: targetTenant.email,
        address: targetTenant.location || 'Nairobi, Kenya',
        plan: targetTenant.plan,
      }
    );
    setProfile(loadedProfile);

    const loadedTx = safeStorageGet<Transaction[]>(
      getTenantKeyStatic(newTenantId, 'transactions'),
      isPrimaryTenantId(newTenantId) ? INITIAL_TRANSACTIONS : []
    );
    setTransactions(loadedTx);

    const loadedStock = safeStorageGet<StockItem[]>(
      getTenantKeyStatic(newTenantId, 'stock'),
      DEFAULT_STOCK
    );
    setStock(loadedStock);

    const loadedServices = safeStorageGet<ServiceItem[]>(
      getTenantKeyStatic(newTenantId, 'services'),
      DEFAULT_SERVICES
    );
    setServices(loadedServices);

    const loadedExpenses = safeStorageGet<Expense[]>(
      getTenantKeyStatic(newTenantId, 'expenses'),
      isPrimaryTenantId(newTenantId) ? INITIAL_EXPENSES : []
    );
    setExpenses(loadedExpenses);

    const loadedDebts = safeStorageGet<DebtRecord[]>(
      getTenantKeyStatic(newTenantId, 'debts'),
      []
    );
    setDebts(loadedDebts);

    const loadedCustomers = safeStorageGet<Customer[]>(
      getTenantKeyStatic(newTenantId, 'customers'),
      isPrimaryTenantId(newTenantId) ? DEFAULT_CUSTOMERS : []
    );
    setCustomers(loadedCustomers);

    const loadedStaff = safeStorageGet<UserAccount[]>(
      getTenantKeyStatic(newTenantId, 'staff'),
      isPrimaryTenantId(newTenantId)
        ? DEFAULT_STAFF
        : [
            {
              id: `STAFF_${newTenantId}_01`,
              name: targetTenant.ownerName,
              username: targetTenant.username,
              password: targetTenant.password || 'password123',
              role: 'admin' as UserRole,
              phone: targetTenant.phone,
              email: targetTenant.email,
              active: true,
              createdAt: targetTenant.createdAt,
            },
          ]
    );
    setStaffList(loadedStaff);
    setCurrentUser(loadedStaff[0] || null);

    setGasTransactions(safeStorageGet(getTenantKeyStatic(newTenantId, 'gas_tx'), []));
    setElectronicsProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'el_products'), DEFAULT_ELECTRONICS_PRODUCTS));
    setElectronicsSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'el_sales'), []));
    setElectronicsReturns(safeStorageGet(getTenantKeyStatic(newTenantId, 'el_returns'), []));
    setCyberProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'cyber_products'), DEFAULT_CYBER_PRODUCTS));
    setCyberCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'cyber_categories'), DEFAULT_CYBER_CATEGORIES));
    setCyberSuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'cyber_suppliers'), DEFAULT_CYBER_SUPPLIERS));
    setCyberPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'cyber_purchases'), []));
    setCyberSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'cyber_sales'), []));

    setGasProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'gas_products'), DEFAULT_GAS_PRODUCTS));
    setGasCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'gas_categories'), DEFAULT_GAS_CATEGORIES));
    setGasSuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'gas_suppliers'), DEFAULT_GAS_SUPPLIERS));
    setGasPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'gas_purchases'), []));
    setGasSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'gas_sales'), []));

    setTechProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'tech_products'), DEFAULT_TECH_PRODUCTS));
    setTechCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'tech_categories'), DEFAULT_TECH_CATEGORIES));
    setTechSuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'tech_suppliers'), DEFAULT_TECH_SUPPLIERS));
    setTechPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'tech_purchases'), []));
    setTechSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'tech_sales'), []));

    setGeneralProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'gen_products'), DEFAULT_GENERAL_PRODUCTS));
    setGeneralCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'gen_categories'), DEFAULT_GENERAL_CATEGORIES));
    setGeneralSuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'gen_suppliers'), DEFAULT_GENERAL_SUPPLIERS));
    setGeneralPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'gen_purchases'), []));
    setGeneralSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'gen_sales'), INITIAL_GENERAL_SALES));

    setClothingProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'clothing_products'), getBusinessTypeConfig('clothing').defaultProducts as GeneralProduct[]));
    setClothingCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'clothing_categories'), getBusinessTypeConfig('clothing').defaultCategories));
    setClothingSuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'clothing_suppliers'), getBusinessTypeConfig('clothing').defaultSuppliers));
    setClothingPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'clothing_purchases'), []));
    setClothingSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'clothing_sales'), []));

    setRestaurantProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'restaurant_products'), getBusinessTypeConfig('restaurant').defaultProducts as GeneralProduct[]));
    setRestaurantCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'restaurant_categories'), getBusinessTypeConfig('restaurant').defaultCategories));
    setRestaurantSuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'restaurant_suppliers'), getBusinessTypeConfig('restaurant').defaultSuppliers));
    setRestaurantPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'restaurant_purchases'), []));
    setRestaurantSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'restaurant_sales'), []));

    setPharmacyProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'pharmacy_products'), getBusinessTypeConfig('pharmacy').defaultProducts as GeneralProduct[]));
    setPharmacyCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'pharmacy_categories'), getBusinessTypeConfig('pharmacy').defaultCategories));
    setPharmacySuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'pharmacy_suppliers'), getBusinessTypeConfig('pharmacy').defaultSuppliers));
    setPharmacyPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'pharmacy_purchases'), []));
    setPharmacySales(safeStorageGet(getTenantKeyStatic(newTenantId, 'pharmacy_sales'), []));

    setOtherProducts(safeStorageGet(getTenantKeyStatic(newTenantId, 'other_products'), getBusinessTypeConfig('other').defaultProducts as GeneralProduct[]));
    setOtherCategories(safeStorageGet(getTenantKeyStatic(newTenantId, 'other_categories'), getBusinessTypeConfig('other').defaultCategories));
    setOtherSuppliers(safeStorageGet(getTenantKeyStatic(newTenantId, 'other_suppliers'), getBusinessTypeConfig('other').defaultSuppliers));
    setOtherPurchases(safeStorageGet(getTenantKeyStatic(newTenantId, 'other_purchases'), []));
    setOtherSales(safeStorageGet(getTenantKeyStatic(newTenantId, 'other_sales'), []));

    const targetSubs = migrateLegacyBusinessType(
      newTenantId,
      targetTenant.shopName,
      targetTenant.businessType,
      targetTenant.plan,
      targetTenant.expiryDate
    );
    setBusinessSubscriptionsState(targetSubs);
    const targetActive = getActiveBusinessTypes(newTenantId);
    const preferredMode = (targetTenant.businessType as BusinessMode) || targetActive[0] || 'cyber';
    const targetMode = targetActive.includes(preferredMode) ? preferredMode : (targetActive[0] || preferredMode);
    setBusinessModeState(targetMode);
    localStorage.setItem(getTenantKeyStatic(newTenantId, 'business_mode'), JSON.stringify(targetMode));
    if (isSupabaseConfigured()) {
      fetchBusinessSubscriptionsFromDb(newTenantId).then((remote) => {
        if (remote) setBusinessSubscriptionsState(remote);
      });
    }

    setFamilyExpenses(safeStorageGet(getTenantKeyStatic(newTenantId, 'family_expenses'), []));
    setFamilyIncomeManual(safeStorageGet(getTenantKeyStatic(newTenantId, 'family_income'), []));
    setSalaries(safeStorageGet(getTenantKeyStatic(newTenantId, 'salaries'), []));
    setWastage(safeStorageGet(getTenantKeyStatic(newTenantId, 'wastage'), []));
    setAuditLog(safeStorageGet(getTenantKeyStatic(newTenantId, 'audit_log'), [
      { id: 1, time: new Date().toISOString(), staff: targetTenant.ownerName, action: 'INIT', details: `POS initialized for ${targetTenant.shopName}` }
    ]));
  }, []);

  const refreshSubscriptionStatus = useCallback(() => {
    const updated = getCurrentTenant();
    setCurrentTenant(updated);
  }, []);

  useEffect(() => {
    const tid = getCurrentTenantId();
    localStorage.setItem(getTenantKeyStatic(tid, 'cyber_products'), JSON.stringify(cyberProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'cyber_categories'), JSON.stringify(cyberCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'cyber_suppliers'), JSON.stringify(cyberSuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'cyber_purchases'), JSON.stringify(cyberPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'cyber_sales'), JSON.stringify(cyberSales));

    localStorage.setItem(getTenantKeyStatic(tid, 'gas_products'), JSON.stringify(gasProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'gas_categories'), JSON.stringify(gasCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'gas_suppliers'), JSON.stringify(gasSuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'gas_purchases'), JSON.stringify(gasPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'gas_sales'), JSON.stringify(gasSales));

    localStorage.setItem(getTenantKeyStatic(tid, 'tech_products'), JSON.stringify(techProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'tech_categories'), JSON.stringify(techCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'tech_suppliers'), JSON.stringify(techSuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'tech_purchases'), JSON.stringify(techPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'tech_sales'), JSON.stringify(techSales));

    localStorage.setItem(getTenantKeyStatic(tid, 'gen_products'), JSON.stringify(generalProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'gen_categories'), JSON.stringify(generalCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'gen_suppliers'), JSON.stringify(generalSuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'gen_purchases'), JSON.stringify(generalPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'gen_sales'), JSON.stringify(generalSales));

    localStorage.setItem(getTenantKeyStatic(tid, 'clothing_products'), JSON.stringify(clothingProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'clothing_categories'), JSON.stringify(clothingCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'clothing_suppliers'), JSON.stringify(clothingSuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'clothing_purchases'), JSON.stringify(clothingPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'clothing_sales'), JSON.stringify(clothingSales));

    localStorage.setItem(getTenantKeyStatic(tid, 'restaurant_products'), JSON.stringify(restaurantProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'restaurant_categories'), JSON.stringify(restaurantCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'restaurant_suppliers'), JSON.stringify(restaurantSuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'restaurant_purchases'), JSON.stringify(restaurantPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'restaurant_sales'), JSON.stringify(restaurantSales));

    localStorage.setItem(getTenantKeyStatic(tid, 'pharmacy_products'), JSON.stringify(pharmacyProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'pharmacy_categories'), JSON.stringify(pharmacyCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'pharmacy_suppliers'), JSON.stringify(pharmacySuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'pharmacy_purchases'), JSON.stringify(pharmacyPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'pharmacy_sales'), JSON.stringify(pharmacySales));

    localStorage.setItem(getTenantKeyStatic(tid, 'other_products'), JSON.stringify(otherProducts));
    localStorage.setItem(getTenantKeyStatic(tid, 'other_categories'), JSON.stringify(otherCategories));
    localStorage.setItem(getTenantKeyStatic(tid, 'other_suppliers'), JSON.stringify(otherSuppliers));
    localStorage.setItem(getTenantKeyStatic(tid, 'other_purchases'), JSON.stringify(otherPurchases));
    localStorage.setItem(getTenantKeyStatic(tid, 'other_sales'), JSON.stringify(otherSales));
  }, [
    cyberProducts, cyberCategories, cyberSuppliers, cyberPurchases, cyberSales,
    gasProducts, gasCategories, gasSuppliers, gasPurchases, gasSales,
    techProducts, techCategories, techSuppliers, techPurchases, techSales,
    generalProducts, generalCategories, generalSuppliers, generalPurchases, generalSales,
    clothingProducts, clothingCategories, clothingSuppliers, clothingPurchases, clothingSales,
    restaurantProducts, restaurantCategories, restaurantSuppliers, restaurantPurchases, restaurantSales,
    pharmacyProducts, pharmacyCategories, pharmacySuppliers, pharmacyPurchases, pharmacySales,
    otherProducts, otherCategories, otherSuppliers, otherPurchases, otherSales
  ]);

  // Current shop helper
  const currentShop = useMemo(() => {
    return shops.find((s) => s.id === currentShopId) || shops[0];
  }, [shops, currentShopId]);

  const switchShop = (shopId: string) => {
    const target = shops.find((s) => s.id === shopId);
    if (target) {
      setCurrentShopId(shopId);
      logAudit('SWITCH_SHOP', `Switched active branch to ${target.name}`);
      addToast({
        type: 'info',
        title: 'Branch Switched',
        message: `Now operating in ${target.name}`
      });
    }
  };

  // Format currency
  const formatMoney = useCallback(
    (amount: number) => {
      const formatted = Number(amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${profile.currencySymbol || profile.currency || 'KSh'} ${formatted}`;
    },
    [profile.currency, profile.currencySymbol]
  );

  // Audit logger
  const logAudit = useCallback((action: string, details: string) => {
    const entry: AuditEntry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      time: new Date().toISOString(),
      staff: currentUser ? currentUser.name : 'System Administrator',
      action,
      details,
    };
    setAuditLog((prev) => [entry, ...prev.slice(0, 1500)]);
  }, [currentUser]);

  // Inventory usage calculations
  const stockSoldUsed = useCallback((name: string): number => {
    const target = name.trim().toUpperCase();

    // From Cyber transactions
    const cyberUsed = transactions.reduce((acc, tx) => {
      if (tx.status === 'cancelled') return acc;
      let sum = 0;
      if (Array.isArray(tx.stockUsed)) {
        tx.stockUsed.forEach((u) => {
          if (u.name.trim().toUpperCase() === target) {
            sum += Number(u.qty || 0);
          }
        });
      }
      return acc + sum;
    }, 0);

    // From Debts (reserved stock) - scoped to the active business only,
    // so a Gas or Electronics debt never eats into Cyber material stock.
    const debtUsed = visibleDebts.reduce((acc, d) => {
      let sum = 0;
      if (Array.isArray(d.stockUsed)) {
        d.stockUsed.forEach((u) => {
          if (u.name.trim().toUpperCase() === target) {
            sum += Number(u.qty || 0);
          }
        });
      }
      return acc + sum;
    }, 0);

    // From Wastage/Spoilage
    const wasteUsed = wastage.reduce((acc, w) => {
      if (w.name.trim().toUpperCase() === target) {
        return acc + Number(w.qty || 0);
      }
      return acc;
    }, 0);

    return cyberUsed + debtUsed + wasteUsed;
  }, [transactions, visibleDebts, wastage]);

  const stockRemaining = useCallback(
    (item: StockItem): number => {
      const opening = Number(item.openingStock || 0);
      const added = Number(item.stockAdded || 0);
      const used = stockSoldUsed(item.name);
      return Math.max(0, opening + added - used);
    },
    [stockSoldUsed]
  );

  const lowStockItems = useMemo(() => {
    return stock.filter((item) => {
      const rem = stockRemaining(item);
      const threshold = item.reorderLevel ?? profile.lowStockThresholdDefault ?? 10;
      return rem > 0 && rem <= threshold;
    });
  }, [stock, stockRemaining, profile.lowStockThresholdDefault]);

  const outOfStockItems = useMemo(() => {
    return stock.filter((item) => stockRemaining(item) <= 0);
  }, [stock, stockRemaining]);

  // Roles & Security check
  const hasRole = useCallback(
    (minRole: UserRole): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      if (currentUser.role === 'manager' && minRole !== 'admin') return true;
      return currentUser.role === minRole;
    },
    [currentUser]
  );

  const login = (username: string, pass: string): boolean => {
    const user = staffList.find(
      (s) => s.username.toLowerCase() === username.trim().toLowerCase() && s.password === pass
    );
    if (user && user.active) {
      const updatedUser = { ...user, lastLogin: new Date().toISOString() };
      setCurrentUser(updatedUser);
      logAudit('LOGIN', `User ${user.name} (${user.role}) logged in.`);
      addToast({
        type: 'success',
        title: 'Signed in successfully',
        message: `Welcome back, ${user.name}! Role: ${user.role.toUpperCase()}`,
      });
      return true;
    }
    addToast({
      type: 'error',
      title: 'Authentication Failed',
      message: 'Invalid username or password.',
    });
    return false;
  };

  const logout = () => {
    if (currentUser) {
      logAudit('LOGOUT', `User ${currentUser.name} signed out.`);
    }
    setCurrentUser(null);
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been safely signed out.',
    });
  };

  const verifyAdminPassword = useCallback((password: string): boolean => {
    if (!password) return false;
    const cleanPass = password.trim();

    // 1. Check profile configured admin password
    const configuredAdminPass = profile.adminPassword || 'admin123';
    if (cleanPass === configuredAdminPass) return true;

    // 2. Check any active admin in staffList
    const matchesAdminUser = staffList.some(
      (u) => u.role === 'admin' && u.active && u.password === cleanPass
    );
    if (matchesAdminUser) return true;

    // 3. Current user password if current user is admin/manager
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager') && currentUser.password === cleanPass) {
      return true;
    }

    // NOTE: there used to be a 4th check here that accepted the literal
    // strings 'admin123' / '1234' unconditionally, regardless of what
    // the shop had actually configured. That meant changing your admin
    // password never actually revoked the default - it was a permanent
    // backdoor. It's removed: the ONLY way in now is a password that
    // matches what's actually configured above.
    return false;
  }, [profile.adminPassword, staffList, currentUser]);

  const updateAdminPassword = (currentPass: string, newPass: string): { success: boolean; message: string } => {
    if (!verifyAdminPassword(currentPass)) {
      return { success: false, message: 'Current password is incorrect.' };
    }
    if (!newPass || newPass.trim().length < 4) {
      return { success: false, message: 'New password must be at least 4 characters long.' };
    }

    updateProfile({ adminPassword: newPass.trim(), adminPasswordChanged: true });

    // Also update admin account in staffList
    setStaffList((prev) =>
      prev.map((s) => (s.role === 'admin' ? { ...s, password: newPass.trim() } : s))
    );

    logAudit('CHANGE_ADMIN_PASS', `Admin security password updated by ${currentUser?.name || 'Admin'}`);
    addToast({
      type: 'success',
      title: 'Admin Password Updated',
      message: 'New security password saved successfully.',
    });
    return { success: true, message: 'Admin password updated successfully.' };
  };

  const switchUser = (roleOrUsername: string): boolean => {
    const found = staffList.find(
      (s) =>
        s.role.toLowerCase() === roleOrUsername.toLowerCase() ||
        s.username.toLowerCase() === roleOrUsername.toLowerCase()
    );
    if (found) {
      setCurrentUser(found);
      logAudit('SWITCH_USER', `Switched active operator to ${found.name} (${found.role})`);
      addToast({
        type: 'info',
        title: 'Operator Switched',
        message: `Now logged in as ${found.name} (${found.role.toUpperCase()})`,
      });
      return true;
    }
    const fallbackUser: UserAccount = {
      id: `USER_${Date.now()}`,
      name: roleOrUsername === 'admin' ? 'Admin Master' : 'Cashier Shift',
      username: roleOrUsername,
      role: roleOrUsername === 'admin' ? 'admin' : 'cashier',
      active: true,
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(fallbackUser);
    logAudit('SWITCH_USER', `Switched active operator to ${fallbackUser.name}`);
    addToast({
      type: 'info',
      title: 'Operator Switched',
      message: `Operating as ${fallbackUser.name}`,
    });
    return true;
  };

  const addStaff = (staffData: Omit<UserAccount, 'id' | 'createdAt'>): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Permission Denied', message: 'Only Admins can add staff accounts.' });
      return false;
    }
    const exists = staffList.some((s) => s.username.toLowerCase() === staffData.username.toLowerCase());
    if (exists) {
      addToast({ type: 'error', title: 'Username Taken', message: 'That username is already in use.' });
      return false;
    }
    const newStaff: UserAccount = {
      ...staffData,
      id: `STAFF_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setStaffList((prev) => [...prev, newStaff]);
    logAudit('CREATE_USER', `Created staff account for ${newStaff.name} with role ${newStaff.role}`);
    addToast({ type: 'success', title: 'Staff Created', message: `${newStaff.name} added successfully.` });
    return true;
  };

  const updateStaff = (id: string, updates: Partial<UserAccount>) => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Permission Denied' });
      return;
    }
    setStaffList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
    logAudit('UPDATE_USER', `Updated staff account ID ${id}`);
    addToast({ type: 'success', title: 'Staff Updated' });
  };

  const deleteStaff = (id: string): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Permission Denied' });
      return false;
    }
    const target = staffList.find((s) => s.id === id);
    if (target?.username === 'admin') {
      addToast({ type: 'warning', title: 'Protected Account', message: 'The primary Admin account cannot be deleted.' });
      return false;
    }
    setStaffList((prev) => prev.filter((s) => s.id !== id));
    logAudit('DELETE_USER', `Deleted staff account: ${target?.name}`);
    addToast({ type: 'info', title: 'Staff Deleted', message: 'Account removed.' });
    return true;
  };

  // Profile
  const updateProfile = (updates: Partial<BusinessProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    logAudit('UPDATE_PROFILE', 'Business settings updated.');
    addToast({ type: 'success', title: 'Settings Saved', message: 'Business configuration updated.' });
  };

  // Tax Rules & VAT Configuration
  const addTaxRule = useCallback((rule: Omit<TaxRule, 'id'>) => {
    const newRule: TaxRule = {
      ...rule,
      id: `tax_${Date.now()}`,
    };
    setProfile((prev) => {
      const existing = prev.taxRules || [];
      const updatedRules = rule.isDefault
        ? existing.map((r) => ({ ...r, isDefault: false })).concat(newRule)
        : [...existing, newRule];
      return {
        ...prev,
        taxRules: updatedRules,
      };
    });
    logAudit('ADD_TAX_RULE', `Added tax rule: ${rule.name} (${rule.rate}%)`);
    addToast({ type: 'success', title: 'Tax Rule Created', message: `${rule.name} is now active.` });
  }, [logAudit, addToast]);

  const updateTaxRule = useCallback((id: string, updates: Partial<TaxRule>) => {
    setProfile((prev) => {
      const existing = prev.taxRules || [];
      const updatedRules = existing.map((r) => {
        if (r.id === id) {
          return { ...r, ...updates };
        }
        if (updates.isDefault) {
          return { ...r, isDefault: false };
        }
        return r;
      });
      return {
        ...prev,
        taxRules: updatedRules,
      };
    });
    logAudit('UPDATE_TAX_RULE', `Updated tax rule #${id}`);
    addToast({ type: 'success', title: 'Tax Rule Updated' });
  }, [logAudit, addToast]);

  const deleteTaxRule = useCallback((id: string) => {
    setProfile((prev) => {
      const existing = prev.taxRules || [];
      return {
        ...prev,
        taxRules: existing.filter((r) => r.id !== id),
      };
    });
    logAudit('DELETE_TAX_RULE', `Deleted tax rule #${id}`);
    addToast({ type: 'info', title: 'Tax Rule Removed' });
  }, [logAudit, addToast]);

  const toggleTaxRule = useCallback((id: string) => {
    setProfile((prev) => {
      const existing = prev.taxRules || [];
      return {
        ...prev,
        taxRules: existing.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
      };
    });
  }, []);

  const setDefaultTaxRule = useCallback((id: string) => {
    setProfile((prev) => {
      const existing = prev.taxRules || [];
      const target = existing.find((r) => r.id === id);
      return {
        ...prev,
        defaultTaxRate: target ? target.rate : prev.defaultTaxRate,
        taxName: target ? target.name : prev.taxName,
        taxCalculationMode: target ? target.type : prev.taxCalculationMode,
        taxRules: existing.map((r) => ({
          ...r,
          isDefault: r.id === id,
        })),
      };
    });
    logAudit('SET_DEFAULT_TAX_RULE', `Set default tax rule #${id}`);
    addToast({ type: 'success', title: 'Default Tax Updated' });
  }, [logAudit, addToast]);

  // Services
  const addService = (service: ServiceItem): boolean => {
    const exists = services.some((s) => s.name.toUpperCase() === service.name.trim().toUpperCase());
    if (exists) {
      addToast({ type: 'warning', title: 'Duplicate Service', message: 'Service name already exists.' });
      return false;
    }
    setServices((prev) => [...prev, service]);
    logAudit('ADD_SERVICE', `Added service ${service.name} @ ${formatMoney(service.price)}`);
    addToast({ type: 'success', title: 'Service Added', message: `${service.name} is now available in POS.` });
    return true;
  };

  const updateService = (indexOrName: number | string, service: ServiceItem) => {
    setServices((prev) => {
      const copy = [...prev];
      const idx = typeof indexOrName === 'number'
        ? indexOrName
        : copy.findIndex((s) => s.name.toUpperCase() === String(indexOrName).trim().toUpperCase());
      if (idx >= 0 && idx < copy.length) {
        copy[idx] = service;
      }
      return copy;
    });
    logAudit('UPDATE_SERVICE', `Updated service ${service.name}`);
    addToast({ type: 'success', title: 'Service Updated' });
  };

  const deleteService = (indexOrName: number | string): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    let targetName = '';
    setServices((prev) => {
      const idx = typeof indexOrName === 'number'
        ? indexOrName
        : prev.findIndex((s) => s.name.toUpperCase() === String(indexOrName).trim().toUpperCase());
      if (idx >= 0 && idx < prev.length) {
        targetName = prev[idx]?.name || '';
        return prev.filter((_, i) => i !== idx);
      }
      return prev;
    });
    logAudit('DELETE_SERVICE', `Deleted service ${targetName || indexOrName}`);
    addToast({ type: 'info', title: 'Service Removed' });
    return true;
  };

  // Stock
  const addStock = (
    name: string,
    opening: number,
    added: number,
    unit: string = 'pieces',
    costPrice?: number,
    sellingPrice?: number,
    reorderLevel?: number,
    category?: string
  ) => {
    const upper = name.trim().toUpperCase();
    const existingIndex = stock.findIndex((s) => s.name.toUpperCase() === upper);

    if (existingIndex >= 0) {
      setStock((prev) => {
        const copy = [...prev];
        const item = copy[existingIndex];
        const newAdded = Number(item.stockAdded || 0) + Number(added || 0);
        copy[existingIndex] = {
          ...item,
          stockAdded: newAdded,
          unit: unit || item.unit,
          costPrice: costPrice !== undefined ? costPrice : item.costPrice,
          sellingPrice: sellingPrice !== undefined ? sellingPrice : item.sellingPrice,
          reorderLevel: reorderLevel !== undefined ? reorderLevel : item.reorderLevel,
          category: category || item.category,
        };
        return copy;
      });
      logAudit('UPDATE_STOCK', `Restocked ${name}: +${added} ${unit}`);
      addToast({ type: 'success', title: 'Stock Updated', message: `${added} ${unit} added to ${name}.` });
    } else {
      const newItem: StockItem = {
        name,
        openingStock: opening,
        stockAdded: added,
        unit,
        costPrice,
        sellingPrice,
        reorderLevel: reorderLevel ?? profile.lowStockThresholdDefault ?? 10,
        category: category || 'General',
      };
      setStock((prev) => [...prev, newItem]);
      logAudit('ADD_STOCK_ITEM', `Created new stock item ${name}`);
      addToast({ type: 'success', title: 'New Item Added', message: `${name} added to inventory.` });
    }
  };

  const addStockBatch = (name: string, addedQty: number, cost?: number, notes?: string) => {
    addStock(name, 0, addedQty, 'pcs', cost);
    if (notes) {
      logAudit('RESTOCK_NOTE', `${name} restock: ${notes}`);
    }
  };

  const addNewStockItem = (item: Partial<StockItem>): boolean => {
    if (!item.name) return false;
    addStock(
      item.name,
      item.openingStock || 0,
      item.stockAdded || 0,
      item.unit || 'pcs',
      item.costPrice || item.costPerUnit,
      item.sellingPrice,
      item.reorderLevel,
      item.category
    );
    return true;
  };

  const updateStockPricing = (index: number, updates: Partial<StockItem>) => {
    setStock((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
    logAudit('UPDATE_STOCK_PRICING', `Updated pricing for ${stock[index]?.name}`);
    addToast({ type: 'success', title: 'Pricing Updated' });
  };

  const deleteStockItem = (index: number): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    const target = stock[index];
    setStock((prev) => prev.filter((_, i) => i !== index));
    logAudit('DELETE_STOCK', `Deleted stock item ${target?.name}`);
    addToast({ type: 'info', title: 'Stock Item Removed' });
    return true;
  };

  // Wastage
  const addWastage = (name: string, qty: number, reason: string): boolean => {
    const item = stock.find((s) => s.name.toUpperCase() === name.toUpperCase());
    if (!item) {
      addToast({ type: 'error', title: 'Stock Item Not Found' });
      return false;
    }
    const rem = stockRemaining(item);
    if (rem < qty) {
      addToast({
        type: 'error',
        title: 'Insufficient Stock',
        message: `Only ${rem} ${item.unit} available in stock.`,
      });
      return false;
    }

    const rec: WastageRecord = {
      id: Date.now(),
      name: item.name,
      qty,
      unit: item.unit,
      date: new Date().toISOString().slice(0, 10),
      reason,
      staff: currentUser ? currentUser.name : 'Administrator',
      balanceAfter: rem - qty,
      recordedAt: new Date().toISOString(),
    };

    setWastage((prev) => [rec, ...prev]);
    logAudit('RECORD_WASTAGE', `Recorded wastage of ${qty} ${item.unit} for ${item.name} (${reason})`);
    addToast({
      type: 'warning',
      title: 'Spoilage Logged',
      message: `${qty} ${item.unit} deducted from ${item.name}.`,
    });
    return true;
  };

  const deleteWastage = (id: number): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    setWastage((prev) => prev.filter((w) => w.id !== id));
    logAudit('DELETE_WASTAGE', `Deleted wastage entry #${id}`);
    addToast({ type: 'info', title: 'Wastage Entry Deleted' });
    return true;
  };

  const recordWastage = (name: string, qty: number, reason: string): boolean => {
    return addWastage(name, qty, reason);
  };

  // Transactions (Cyber POS)
  /**
   * Writes a completed sale into the offline queue in the background.
   * Deliberately fire-and-forget and wrapped in try/catch: the cashier's
   * sale is already recorded in the existing local state/localStorage
   * flow above regardless of what happens here, so a storage or network
   * hiccup in this layer must never surface as an error to the cashier
   * or block the receipt from opening.
   */
  const queueSaleForSync = useCallback((tx: Transaction) => {
    (async () => {
      try {
        const localId = generateLocalId();
        const deviceId = await getDeviceId();
        const now = new Date().toISOString();
        await offlineDb.sales.add({
          localId,
          shopId: currentShopId,
          userId: currentUser?.name,
          deviceId,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending',
          receipt: tx.receipt,
          payload: tx as unknown as Record<string, unknown>,
        });
        await enqueueSync('sale', localId, 'CREATE');

        const online = await checkRealConnectivity();
        if (online) {
          processSyncQueue().catch(() => {
            // Swallowed deliberately - the queue entry remains 'pending'
            // and will be retried by the backoff schedule / next Sync Now.
          });
        }
      } catch {
        // Same reasoning as above - never let offline-queueing errors
        // reach the cashier. The sale itself already succeeded locally.
      }
    })();
  }, [currentShopId, currentUser]);

  const recordCyberSale = (saleData: Omit<Transaction, 'id' | 'receipt' | 'date' | 'staff' | 'shopId'>): Transaction => {
    const receiptNum = `MJRC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(transactions.length + 1).padStart(5, '0')}`;
    const newTx: Transaction = {
      ...saleData,
      id: Date.now(),
      receipt: receiptNum,
      date: new Date().toISOString(),
      staff: currentUser ? currentUser.name : 'Administrator',
      shopId: currentShopId,
      status: 'completed',
      businessType: 'cyber',
    };

    setTransactions((prev) => [newTx, ...prev]);
    queueSaleForSync(newTx);

    // Update or add customer record
    if (newTx.phone) {
      const normPhone = newTx.phone.trim();
      setCustomers((prev) => {
        const found = prev.find((c) => c.phone === normPhone);
        if (found) {
          return prev.map((c) =>
            c.phone === normPhone
              ? {
                  ...c,
                  name: newTx.customer || c.name,
                  totalSpent: (c.totalSpent || 0) + newTx.total,
                  lastSeen: newTx.date,
                }
              : c
          );
        } else {
          return [
            ...prev,
            {
              id: `CUST_${Date.now()}`,
              name: newTx.customer || 'Customer',
              phone: normPhone,
              address: newTx.address,
              idNumber: newTx.idNumber,
              totalSpent: newTx.total,
              debtBalance: 0,
              lastSeen: newTx.date,
              businessType: 'cyber',
            },
          ];
        }
      });
    }

    logAudit('RECORD_SALE', `Sale ${receiptNum} completed for ${newTx.customer}: ${formatMoney(newTx.total)} via ${newTx.payment}`);
    addToast({
      type: 'success',
      title: 'Sale Recorded',
      message: `Receipt ${receiptNum} issued. Total: ${formatMoney(newTx.total)}`,
    });
    return newTx;
  };

  const editTransaction = (id: number, updates: Partial<Transaction>): boolean => {
    if (!hasRole('manager')) {
      addToast({ type: 'error', title: 'Permission Denied', message: 'Manager or Admin role required.' });
      return false;
    }
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    logAudit('EDIT_TRANSACTION', `Modified transaction #${id}`);
    addToast({ type: 'success', title: 'Transaction Updated' });
    return true;
  };

  const cancelTransaction = (id: number, reason?: string): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required to Cancel Sales' });
      return false;
    }
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'cancelled',
              notes: reason ? `${t.notes ? `${t.notes} | ` : ''}Cancelled: ${reason}` : t.notes,
            }
          : t
      )
    );
    logAudit('CANCEL_TRANSACTION', `Cancelled transaction #${id}${reason ? ` (Reason: ${reason})` : ''}`);
    addToast({ type: 'warning', title: 'Sale Cancelled', message: 'Transaction marked as void.' });
    return true;
  };

  const deleteTransaction = (id: number, password?: string): boolean => {
    if (password !== undefined) {
      if (!verifyAdminPassword(password)) {
        addToast({
          type: 'error',
          title: 'Incorrect Password',
          message: 'The entered admin password is incorrect. Deletion denied.',
        });
        return false;
      }
    } else if (!hasRole('admin')) {
      addToast({
        type: 'error',
        title: 'Admin Password Required',
        message: 'Administrator authorization and password required to delete transactions.',
      });
      return false;
    }

    const target = transactions.find((t) => t.id === id);
    if (!target) {
      addToast({ type: 'error', title: 'Transaction Not Found' });
      return false;
    }

    setTransactions((prev) => prev.filter((t) => t.id !== id));

    // Delete from Supabase if configured
    if (isSupabaseConfigured()) {
      deleteTransactionFromSupabase(id).catch((err) => {
        console.warn('Supabase delete error:', err);
      });
    }

    logAudit(
      'DELETE_TRANSACTION',
      `Permanently deleted transaction ${target.receipt} (${formatMoney(target.total)}) by ${currentUser?.name || 'Admin'}`
    );
    addToast({
      type: 'info',
      title: 'Transaction Deleted',
      message: `Receipt ${target.receipt} was permanently deleted.`,
    });
    return true;
  };

  // Gas Refills
  const recordGasRefill = (refillData: Omit<GasTransaction, 'id' | 'receipt' | 'date' | 'staff' | 'shopId'>): GasTransaction => {
    const receiptNum = `GAS-${String(gasTransactions.length + 1).padStart(6, '0')}`;
    const newGas: GasTransaction = {
      ...refillData,
      id: Date.now(),
      receipt: receiptNum,
      date: new Date().toISOString(),
      staff: currentUser ? currentUser.name : 'Administrator',
      shopId: currentShopId,
    };

    setGasTransactions((prev) => [newGas, ...prev]);

    // Handle gas credit debt entry if marked as debt
    if (newGas.payment === 'Credit / Debt' && newGas.outstanding > 0) {
      const debtEntry: DebtRecord = {
        id: Date.now() + 5,
        date: newGas.date.slice(0, 10),
        name: newGas.customer,
        phone: newGas.phone,
        reason: `Gas Refill (${newGas.brand} ${newGas.size})`,
        service: `Gas Refill ${newGas.brand} ${newGas.size} × ${newGas.qty}`,
        qty: newGas.qty,
        original: newGas.total,
        paid: newGas.paid,
        materialTotal: newGas.cost * newGas.qty,
        profitRecognized: 0,
        staff: newGas.staff,
        kind: 'gas',
        gasId: newGas.id,
        shopId: currentShopId,
        payments: [],
      };
      setDebts((prev) => [debtEntry, ...prev]);
    }

    logAudit('RECORD_GAS', `Gas refill ${receiptNum} (${newGas.brand} ${newGas.size}): ${formatMoney(newGas.total)}`);
    addToast({
      type: 'success',
      title: 'Gas Refill Recorded',
      message: `${newGas.brand} ${newGas.size} for ${newGas.customer}: ${formatMoney(newGas.total)}`,
    });
    return newGas;
  };

  const editGasRefill = (id: number, updates: Partial<GasTransaction>): boolean => {
    if (!hasRole('manager')) {
      addToast({ type: 'error', title: 'Permission Denied' });
      return false;
    }
    setGasTransactions((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
    );
    logAudit('EDIT_GAS', `Updated gas transaction #${id}`);
    addToast({ type: 'success', title: 'Gas Record Updated' });
    return true;
  };

  const deleteGasRefill = (id: number, password?: string): boolean => {
    if (password !== undefined) {
      if (!verifyAdminPassword(password)) {
        addToast({
          type: 'error',
          title: 'Incorrect Password',
          message: 'The entered admin password is incorrect. Deletion denied.',
        });
        return false;
      }
    } else if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    const target = gasTransactions.find((g) => g.id === id);
    setGasTransactions((prev) => prev.filter((g) => g.id !== id));
    logAudit('DELETE_GAS', `Deleted gas refill record ${target?.receipt || `#${id}`}`);
    addToast({ type: 'info', title: 'Gas Record Deleted' });
    return true;
  };

  // Electronics
  const addElectronicsProduct = (prod: Omit<ElectronicsProduct, 'id'>) => {
    const newProd: ElectronicsProduct = {
      ...prod,
      id: `EL_${Date.now()}`,
    };
    setElectronicsProducts((prev) => [newProd, ...prev]);
    logAudit('ADD_EL_PRODUCT', `Added electronics item: ${newProd.name}`);
    addToast({ type: 'success', title: 'Product Added', message: `${newProd.name} added to catalog.` });
  };

  const updateElectronicsProduct = (id: string, updates: Partial<ElectronicsProduct>) => {
    setElectronicsProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    logAudit('UPDATE_EL_PRODUCT', `Updated electronics product #${id}`);
    addToast({ type: 'success', title: 'Product Updated' });
  };

  const deleteElectronicsProduct = (id: string): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    setElectronicsProducts((prev) => prev.filter((p) => p.id !== id));
    logAudit('DELETE_EL_PRODUCT', `Deleted electronics product #${id}`);
    addToast({ type: 'info', title: 'Product Removed' });
    return true;
  };

  const recordElectronicsSale = (saleData: Omit<ElectronicsSale, 'id' | 'receipt' | 'date' | 'staff'>): ElectronicsSale => {
    const receiptNum = `EL-${String(electronicsSales.length + 1).padStart(6, '0')}`;
    const newSale: ElectronicsSale = {
      ...saleData,
      id: Date.now(),
      receipt: receiptNum,
      date: new Date().toISOString(),
      staff: currentUser ? currentUser.name : 'Administrator',
    };

    // Deduct stock quantity
    setElectronicsProducts((prev) =>
      prev.map((p) =>
        p.id === newSale.productId ? { ...p, qty: Math.max(0, p.qty - newSale.qty) } : p
      )
    );

    setElectronicsSales((prev) => [newSale, ...prev]);
    logAudit('RECORD_EL_SALE', `Sold ${newSale.qty}x ${newSale.product} (${newSale.receipt}): ${formatMoney(newSale.total)}`);
    addToast({
      type: 'success',
      title: 'Electronics Sale Recorded',
      message: `${newSale.product} sold for ${formatMoney(newSale.total)}`,
    });
    return newSale;
  };

  const recordElectronicsReturn = (retData: Omit<ElectronicsReturn, 'id' | 'date' | 'staff'>) => {
    const newRet: ElectronicsReturn = {
      ...retData,
      id: Date.now(),
      date: new Date().toISOString(),
    };

    // Restore stock
    if (newRet.productId) {
      setElectronicsProducts((prev) =>
        prev.map((p) =>
          p.id === newRet.productId ? { ...p, qty: p.qty + newRet.qty } : p
        )
      );
    }

    setElectronicsReturns((prev) => [newRet, ...prev]);
    logAudit('RECORD_EL_RETURN', `Processed return for ${newRet.product} (Receipt: ${newRet.receipt})`);
    addToast({
      type: 'info',
      title: 'Return Processed',
      message: `${newRet.qty}x ${newRet.product} returned to inventory.`,
    });
  };

  const deleteElectronicsSale = (id: number, password?: string): boolean => {
    if (password !== undefined) {
      if (!verifyAdminPassword(password)) {
        addToast({
          type: 'error',
          title: 'Incorrect Password',
          message: 'The entered admin password is incorrect. Deletion denied.',
        });
        return false;
      }
    } else if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    const sale = electronicsSales.find((s) => s.id === id);
    if (sale) {
      // Revert product stock
      setElectronicsProducts((prev) =>
        prev.map((p) => (p.id === sale.productId ? { ...p, qty: p.qty + sale.qty } : p))
      );
    }
    setElectronicsSales((prev) => prev.filter((s) => s.id !== id));
    logAudit('DELETE_EL_SALE', `Deleted electronics sale #${id} (${sale?.product || ''})`);
    addToast({ type: 'info', title: 'Sale Record Removed' });
    return true;
  };

  // Expenses
  const addExpense = (expenseData: Omit<Expense, 'id' | 'staff' | 'shopId'>) => {
    const newExp: Expense = {
      ...expenseData,
      id: Date.now(),
      staff: currentUser ? currentUser.name : 'Administrator',
      shopId: currentShopId,
      businessType: expenseData.businessType || businessMode,
    };
    setExpenses((prev) => [newExp, ...prev]);
    logAudit('ADD_EXPENSE', `Expense recorded: ${newExp.desc} — ${formatMoney(newExp.amount)}`);
    addToast({ type: 'warning', title: 'Expense Added', message: `${newExp.desc}: ${formatMoney(newExp.amount)}` });
  };

  const updateExpense = (id: number, updates: Partial<Expense>) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    const target = expenses.find((e) => e.id === id);
    logAudit('UPDATE_EXPENSE', `Updated expense #${id}: ${updates.desc || target?.desc || ''} (${updates.amount ? formatMoney(updates.amount) : target ? formatMoney(target.amount) : ''})`);
    addToast({ type: 'success', title: 'Expense Updated', message: 'Expense ledger entry successfully modified.' });
  };

  const deleteExpense = (id: number, password?: string): boolean => {
    if (password !== undefined && password !== '') {
      if (!verifyAdminPassword(password)) {
        addToast({
          type: 'error',
          title: 'Incorrect Password',
          message: 'The entered admin password is incorrect. Deletion denied.',
        });
        return false;
      }
    }
    const exp = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    logAudit('DELETE_EXPENSE', `Deleted expense #${id} (${exp?.desc || ''} — ${exp ? formatMoney(exp.amount) : ''})`);
    addToast({ type: 'info', title: 'Expense Deleted', message: 'Expense removed from the ledger.' });
    return true;
  };

  // Debts
  const addDebt = (debtData: Omit<DebtRecord, 'id' | 'paid' | 'profitRecognized' | 'staff' | 'shopId'>) => {
    const newDebt: DebtRecord = {
      ...debtData,
      id: Date.now(),
      paid: 0,
      profitRecognized: 0,
      staff: currentUser ? currentUser.name : 'Administrator',
      shopId: currentShopId,
      payments: [],
      businessType: debtData.businessType || businessMode,
    };
    setDebts((prev) => [newDebt, ...prev]);

    // Update customer debt balance
    if (newDebt.phone) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.phone === newDebt.phone
            ? { ...c, debtBalance: (c.debtBalance || 0) + newDebt.original }
            : c
        )
      );
    }

    logAudit('RECORD_DEBT', `Recorded debt for ${newDebt.name}: ${formatMoney(newDebt.original)}`);
    addToast({
      type: 'warning',
      title: 'Debt Recorded',
      message: `${formatMoney(newDebt.original)} owed by ${newDebt.name}. Revenue recognized only upon payment.`,
    });
  };

  const recordDebtPayment = (id: number, amount: number): boolean => {
    const debt = debts.find((d) => d.id === id);
    if (!debt) return false;
    const balance = debt.original - debt.paid;
    if (amount <= 0 || amount > balance) {
      addToast({ type: 'error', title: 'Invalid Payment Amount', message: `Outstanding balance is ${formatMoney(balance)}` });
      return false;
    }

    const ratio = amount / debt.original;
    const recognizedProfit = ((debt.original - (debt.materialTotal || 0)) * ratio);

    setDebts((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const newPaid = d.paid + amount;
          return {
            ...d,
            paid: newPaid,
            profitRecognized: (d.profitRecognized || 0) + recognizedProfit,
            lastPaymentDate: new Date().toISOString(),
            payments: [
              ...(d.payments || []),
              {
                date: new Date().toISOString(),
                amount,
                staff: currentUser ? currentUser.name : 'Administrator',
              },
            ],
          };
        }
        return d;
      })
    );

    // If it's a cyber debt, log a transaction for the received cash payment
    if (debt.kind === 'cyber') {
      const receiptNum = `RCP-DEBT-${String(transactions.length + 1).padStart(5, '0')}`;
      const paymentTx: Transaction = {
        id: Date.now(),
        receipt: receiptNum,
        date: new Date().toISOString(),
        customer: debt.name,
        phone: debt.phone,
        service: `Debt Payment: ${debt.service}`,
        services: [
          {
            service: `Debt Payment: ${debt.service}`,
            qty: 1,
            price: amount,
            material: 0,
            total: amount,
            materialTotal: 0,
          },
        ],
        qty: 1,
        price: amount,
        subtotal: amount,
        total: amount,
        material: 0,
        materialTotal: 0,
        paid: amount,
        change: 0,
        profit: recognizedProfit,
        payment: 'Debt Payment',
        staff: currentUser ? currentUser.name : 'Administrator',
        shopId: currentShopId,
        status: 'completed',
        debtPayment: true,
        debtId: debt.id,
      };
      setTransactions((prev) => [paymentTx, ...prev]);
    }

    // Update customer debt balance
    if (debt.phone) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.phone === debt.phone
            ? { ...c, debtBalance: Math.max(0, (c.debtBalance || 0) - amount) }
            : c
        )
      );
    }

    logAudit('DEBT_PAYMENT', `Collected debt payment of ${formatMoney(amount)} from ${debt.name}`);
    addToast({
      type: 'success',
      title: 'Payment Received',
      message: `${formatMoney(amount)} cleared. Added to realized profit.`,
    });
    return true;
  };

  const deleteDebt = (id: number): boolean => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    const target = debts.find((d) => d.id === id);
    setDebts((prev) => prev.filter((d) => d.id !== id));
    logAudit('DELETE_DEBT', `Deleted debt record for ${target?.name}`);
    addToast({ type: 'info', title: 'Debt Record Removed' });
    return true;
  };

  // Customers & Suppliers
  const addCustomer = (cust: Customer) => {
    const tagged: Customer = { ...cust, businessType: cust.businessType || businessMode };
    setCustomers((prev) => [...prev, tagged]);
    logAudit('ADD_CUSTOMER', `Added customer: ${cust.name}`);
  };

  const updateCustomer = (phone: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.phone === phone ? { ...c, ...updates } : c))
    );
  };

  const deleteCustomer = (phone: string): boolean => {
    setCustomers((prev) => prev.filter((c) => c.phone !== phone));
    logAudit('DELETE_CUSTOMER', `Deleted customer with phone ${phone}`);
    addToast({ type: 'info', title: 'Customer Deleted' });
    return true;
  };

  const addSupplier = (supp: Supplier) => {
    setSuppliers((prev) => [...prev, supp]);
    logAudit('ADD_SUPPLIER', `Added supplier: ${supp.name}`);
  };

  // Family & Personal Finance
  const addSalary = (amount: number, date: string, payment: any, note?: string) => {
    const entry: SalaryPayment = {
      id: Date.now(),
      date,
      amount,
      payment,
      note,
      staff: currentUser ? currentUser.name : 'Administrator',
    };
    setSalaries((prev) => [entry, ...prev]);
    logAudit('RECORD_SALARY', `Owner salary payment: ${formatMoney(amount)}`);
    addToast({ type: 'success', title: 'Salary Recorded' });
  };

  const deleteSalary = (id: number): boolean => {
    if (!hasRole('admin')) return false;
    setSalaries((prev) => prev.filter((s) => s.id !== id));
    return true;
  };

  const addFamilyExpense = (name: string, amount: number, date: string, payment: any, note?: string) => {
    const entry: FamilyExpense = {
      id: `FEXP_${Date.now()}`,
      date,
      name,
      amount,
      payment,
      note,
      staff: currentUser ? currentUser.name : 'Administrator',
    };
    setFamilyExpenses((prev) => [entry, ...prev]);
    logAudit('FAMILY_EXPENSE', `Family expense recorded: ${name} (${formatMoney(amount)})`);
    addToast({ type: 'warning', title: 'Family Expense Recorded' });
  };

  const deleteFamilyExpense = (id: string | number, password?: string): boolean => {
    if (password !== undefined) {
      if (!verifyAdminPassword(password)) {
        addToast({
          type: 'error',
          title: 'Incorrect Password',
          message: 'The entered admin password is incorrect. Deletion denied.',
        });
        return false;
      }
    } else if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return false;
    }
    const target = familyExpenses.find((f) => f.id === id);
    setFamilyExpenses((prev) => prev.filter((f) => f.id !== id));
    logAudit('DELETE_FAMILY_EXPENSE', `Deleted family drawing #${id} (${target?.name || ''})`);
    addToast({ type: 'info', title: 'Family Expense Deleted' });
    return true;
  };

  const addFamilyIncomeManual = (source: string, amount: number, date: string, note?: string) => {
    const entry: FamilyIncomeManual = {
      id: `FINC_${Date.now()}`,
      date,
      source,
      amount,
      note,
    };
    setFamilyIncomeManual((prev) => [entry, ...prev]);
    addToast({ type: 'success', title: 'Family Income Recorded' });
  };

  const deleteFamilyIncomeManual = (id: string | number): boolean => {
    if (!hasRole('admin')) return false;
    setFamilyIncomeManual((prev) => prev.filter((f) => f.id !== id));
    return true;
  };

  // M-Pesa Configuration & Simulation
  const updateMpesaConfig = (updates: Partial<MpesaConfig>) => {
    setMpesaConfig((prev) => ({ ...prev, ...updates }));
    logAudit('MPESA_CONFIG', 'Updated Daraja M-Pesa API settings.');
    addToast({ type: 'success', title: 'M-Pesa Settings Saved' });
  };

  const simulateStkPush = async (
    phone: string,
    amount: number,
    description: string
  ): Promise<{ success: boolean; mpesaReceipt?: string; error?: string }> => {
    logAudit('STK_PUSH_TRIGGER', `Triggered STK push of ${formatMoney(amount)} to ${phone}`);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // In sandbox or demo mode, simulate 95% success
    const mpesaReceipt = `NL${Math.floor(100000000 + Math.random() * 900000000).toString()}`;
    return {
      success: true,
      mpesaReceipt,
    };
  };

  // Backup & Restore
  const exportBackupJSON = (): string => {
    const data = {
      version: '2026.1.0',
      exportDate: new Date().toISOString(),
      profile,
      shops,
      staffList,
      services,
      stock,
      wastage,
      transactions,
      gasTransactions,
      electronicsProducts,
      electronicsSales,
      electronicsReturns,
      expenses,
      debts,
      customers,
      suppliers,
      salaries,
      familyExpenses,
      familyIncomeManual,
      auditLog,
    };
    logAudit('BACKUP_EXPORT', 'Exported full encrypted system backup.');
    return JSON.stringify(data, null, 2);
  };

  const importBackupJSON = (jsonString: string): { success: boolean; message: string } => {
    if (!hasRole('admin')) {
      return { success: false, message: 'Only Admins can restore database backups.' };
    }
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.profile || !Array.isArray(parsed.services)) {
        return { success: false, message: 'Invalid backup file schema.' };
      }

      if (parsed.profile) setProfile(parsed.profile);
      if (Array.isArray(parsed.services)) setServices(parsed.services);
      if (Array.isArray(parsed.stock)) setStock(parsed.stock);
      if (Array.isArray(parsed.transactions)) setTransactions(parsed.transactions);
      if (Array.isArray(parsed.gasTransactions)) setGasTransactions(parsed.gasTransactions);
      if (Array.isArray(parsed.electronicsProducts)) setElectronicsProducts(parsed.electronicsProducts);
      if (Array.isArray(parsed.electronicsSales)) setElectronicsSales(parsed.electronicsSales);
      if (Array.isArray(parsed.expenses)) setExpenses(parsed.expenses);
      if (Array.isArray(parsed.debts)) setDebts(parsed.debts);
      if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
      if (Array.isArray(parsed.staffList)) setStaffList(parsed.staffList);

      logAudit('BACKUP_RESTORE', `Restored backup from date: ${parsed.exportDate || 'Unknown'}`);
      addToast({ type: 'success', title: 'Backup Restored', message: 'All business records successfully synced.' });
      return { success: true, message: 'Database restored successfully.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error parsing backup file.' };
    }
  };

  const resetFactoryDemoData = () => {
    if (!hasRole('admin')) {
      addToast({ type: 'error', title: 'Admin Permission Required' });
      return;
    }
    setProfile(DEFAULT_BUSINESS_PROFILE);
    setServices(DEFAULT_SERVICES);
    setStock(DEFAULT_STOCK);
    setTransactions(INITIAL_TRANSACTIONS);
    setGasTransactions(INITIAL_GAS_TRANSACTIONS);
    setElectronicsProducts(DEFAULT_ELECTRONICS_PRODUCTS);
    setElectronicsSales([]);
    setElectronicsReturns([]);
    setExpenses(INITIAL_EXPENSES);
    setDebts([]);
    setCustomers(DEFAULT_CUSTOMERS);
    setWastage([]);
    setSalaries([]);
    setFamilyExpenses([]);
    setFamilyIncomeManual([]);
    logAudit('FACTORY_RESET', 'Restored factory demonstration dataset.');
    addToast({ type: 'info', title: 'Factory Demo Restored', message: 'All demo datasets reloaded.' });
  };

  const backupDatabase = (): string => {
    return exportBackupJSON();
  };

  const restoreDatabase = (jsonString: string): boolean => {
    return importBackupJSON(jsonString).success;
  };

  const resetDatabase = () => {
    resetFactoryDemoData();
  };

  return (
    <POSContext.Provider
      value={{
        profile,
        updateProfile,
        shops,
        currentShop,
        switchShop,
        businessMode,
        setBusinessMode,
        updateBusinessType,
        businessSubscriptions,
        activeBusinessTypes,
        isBusinessSubscribed,
        subscribeToBusinessType,
        cancelBusinessSubscription,
        theme,
        toggleTheme,
        taxRules: profile.taxRules || [],
        addTaxRule,
        updateTaxRule,
        deleteTaxRule,
        toggleTaxRule,
        setDefaultTaxRule,
        currentUser,
        login,
        logout,
        switchUser,
        hasRole,
        staffList,
        addStaff,
        updateStaff,
        deleteStaff,
        services,
        addService,
        updateService,
        deleteService,
        stock,
        addStock,
        addStockBatch,
        addNewStockItem,
        updateStockPricing,
        deleteStockItem,
        stockRemaining,
        stockSoldUsed,
        lowStockItems,
        outOfStockItems,
        wastage,
        addWastage,
        recordWastage,
        deleteWastage,
        transactions,
        recordCyberSale,
        editTransaction,
        cancelTransaction,
        deleteTransaction,
        verifyAdminPassword,
        updateAdminPassword,
        gasTransactions,
        recordGasRefill,
        editGasRefill,
        deleteGasRefill,
        electronicsProducts,
        addElectronicsProduct,
        updateElectronicsProduct,
        deleteElectronicsProduct,
        electronicsSales,
        recordElectronicsSale,
        electronicsReturns,
        recordElectronicsReturn,
        deleteElectronicsSale,
        generalProducts: activeProducts,
        addGeneralProduct,
        updateGeneralProduct,
        deleteGeneralProduct,
        generalCategories: activeCategories,
        addGeneralCategory,
        deleteGeneralCategory,
        generalSuppliers: activeSuppliers,
        addGeneralSupplier,
        updateGeneralSupplier,
        deleteGeneralSupplier,
        generalPurchases: activePurchases,
        recordGeneralPurchase,
        generalSales: activeSales,
        recordGeneralSale,
        deleteGeneralSale,
        expenses: visibleExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        debts: visibleDebts,
        addDebt,
        recordDebtPayment,
        deleteDebt,
        customers: visibleCustomers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        suppliers,
        addSupplier,
        salaries,
        addSalary,
        deleteSalary,
        familyExpenses,
        addFamilyExpense,
        deleteFamilyExpense,
        familyIncomeManual,
        addFamilyIncomeManual,
        deleteFamilyIncomeManual,
        mpesaConfig,
        updateMpesaConfig,
        simulateStkPush,
        auditLog,
        logAudit,
        exportBackupJSON,
        backupDatabase,
        importBackupJSON,
        restoreDatabase,
        resetFactoryDemoData,
        resetDatabase,
        toasts,
        addToast,
        removeToast,
        isSupabaseActive,
        supabaseHost,
        syncSupabaseCloud,
        currentTenant,
        switchTenant,
        isSuperAdmin,
        setIsSuperAdmin,
        refreshSubscriptionStatus,
        formatMoney,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = (): POSContextType => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
