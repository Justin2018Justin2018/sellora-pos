export type BusinessMode =
  | 'cyber'
  | 'gas'
  | 'electronics'
  | 'general_shop'
  | 'clothing'
  | 'restaurant'
  | 'pharmacy'
  | 'other'
  | 'all';

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'cashier';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  shopId?: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'TERMINATED';

export type SubscriptionPlan = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'ENTERPRISE' | 'FREE' | 'PRO' | 'BUSINESS';

export interface TenantAccount {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  username: string;
  password?: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  businessType?: BusinessMode;
  startDate: string; // ISO date string YYYY-MM-DD
  expiryDate: string; // ISO date string YYYY-MM-DD
  createdAt: string;
  lastLogin?: string;
  notes?: string;
  location?: string;
  isPrimaryTenant?: boolean;
}

export interface SubscriptionPlanConfig {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  description: string;
  badge?: string;
}

export interface SubscriptionAuditEntry {
  id: string | number;
  time: string;
  admin: string;
  shopId: string;
  shopName: string;
  action:
    | 'ACCOUNT_CREATED'
    | 'ACCOUNT_ACTIVATED'
    | 'ACCOUNT_SUSPENDED'
    | 'ACCOUNT_REACTIVATED'
    | 'ACCOUNT_TERMINATED'
    | 'ACCOUNT_DELETED'
    | 'SUBSCRIPTION_RENEWED'
    | 'SUBSCRIPTION_CHANGED'
    | 'PASSWORD_RESET'
    | 'DETAILS_UPDATED'
    | 'ADMIN_LOGIN'
    | 'ADMIN_LOGOUT'
    | 'FORCE_LOGOUT';
  details: string;
  prevValue?: string;
  newValue?: string;
}

export interface TaxRule {
  id: string;
  name: string;
  rate: number;
  type: 'inclusive' | 'exclusive';
  isDefault?: boolean;
  description?: string;
  active: boolean;
}

export interface BusinessProfile {
  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  tinNumber: string;
  tillNumber?: string;
  kraPin?: string;
  logoUrl?: string;
  currency: string;
  currencySymbol: string;
  plan: SubscriptionPlan;
  licenseStatus?: 'trial' | 'commercial' | 'expired';
  licenseKey?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptNotes?: string;
  receiptFormat?: string;
  autoPrintReceipt?: boolean;
  defaultThermalWidth?: '58' | '80' | 'A4';
  lowStockThresholdDefault: number;
  enableSoundAlerts?: boolean;
  adminPassword?: string;
  // True once the owner has set their own admin PIN (replacing the
  // shipped default). Used to force a one-time PIN change instead of
  // leaving a guessable default password active indefinitely.
  adminPasswordChanged?: boolean;
  // Tax / VAT Rules Configuration
  enableTax?: boolean;
  taxCalculationMode?: 'inclusive' | 'exclusive';
  defaultTaxRate?: number;
  taxName?: string;
  taxRules?: TaxRule[];
}

export interface Shop {
  id: string;
  name: string;
  location: string;
  phone: string;
  active: boolean;
  isMain?: boolean;
}

export interface ServiceItem {
  id?: string;
  name: string;
  price: number;
  material: number;
  deductStock: boolean;
  stockItem?: string;
  stockQty?: number;
  category?: string;
  fromStock?: boolean;
  deductFrom?: string;
  deductLocation?: string;
  deductSource?: 'stock' | 'petty_cash' | 'labor';
}

export interface StockItem {
  id?: string;
  name: string;
  category?: string;
  unit: string;
  costPrice?: number;
  costPerUnit?: number;
  sellingPrice?: number;
  openingStock: number;
  stockAdded: number;
  qty?: number;
  reorderLevel?: number;
  supplier?: string;
}

export interface WastageRecord {
  id: number;
  name: string;
  qty: number;
  unit: string;
  date: string;
  reason: string;
  staff: string;
  balanceAfter?: number;
  recordedAt: string;
}

export interface ServiceLineItem {
  service: string;
  qty: number;
  price: number;
  material: number;
  total: number;
  materialTotal: number;
  stockUsed?: {
    name: string;
    qty: number;
  } | null;
}

export type PaymentMethod = 'Cash' | 'M-Pesa' | 'Card' | 'Bank' | 'Credit / Debt' | 'Debt Payment';

export interface Transaction {
  id: number | string;
  receipt: string;
  date: string;
  customer: string;
  idNumber?: string;
  phone?: string;
  address?: string;
  service: string;
  category?: string;
  services: ServiceLineItem[];
  qty: number;
  price: number;
  subtotal: number;
  total: number;
  material: number;
  materialTotal: number;
  paid: number;
  change: number;
  profit: number;
  payment: PaymentMethod;
  staff: string;
  shopId?: string;
  status?: 'completed' | 'cancelled';
  stockUsed?: Array<{ name: string; qty: number }> | null;
  debtPayment?: boolean;
  debtId?: number;
  notes?: string;
  taxRate?: number;
  taxAmount?: number;
  taxMode?: 'inclusive' | 'exclusive';
  taxName?: string;
}

export interface GasTransaction {
  id: number;
  receipt: string;
  date: string;
  customer: string;
  phone?: string;
  brand: string;
  size: '3 KG' | '6 KG' | '13 KG' | '22 KG' | 'Other';
  qty: number;
  price: number;
  cost: number;
  total: number;
  profit: number;
  paid: number;
  outstanding: number;
  payment: PaymentMethod;
  staff: string;
  shopId?: string;
}

export interface ElectronicsProduct {
  id: string;
  name: string;
  barcode?: string;
  sku?: string;
  brand?: string;
  category?: string;
  supplier?: string;
  buy: number;
  sell: number;
  qty: number;
  min: number;
  warranty?: string;
  serial?: string;
}

export interface ElectronicsSale {
  id: number;
  receipt: string;
  date: string;
  productId: string;
  product: string;
  barcode?: string;
  sku?: string;
  brand?: string;
  category?: string;
  qty: number;
  buy: number;
  sell: number;
  cost: number;
  discount?: number;
  total: number;
  profit: number;
  customer: string;
  phone?: string;
  payment: PaymentMethod;
  paid: number;
  change: number;
  serial?: string;
  warranty?: string;
  staff: string;
}

export interface ElectronicsReturn {
  id: number;
  date: string;
  receipt: string;
  product: string;
  productId?: string;
  serial?: string;
  qty: number;
  amount: number;
  reason: string;
}

export interface Expense {
  id: number;
  date: string;
  desc: string;
  amount: number;
  category?: string;
  payment?: PaymentMethod;
  staff?: string;
  shopId?: string;
}

export interface DebtPaymentEntry {
  date: string;
  amount: number;
  staff?: string;
}

export interface DebtRecord {
  id: number;
  date: string;
  name: string;
  phone?: string;
  reason: string;
  service: string;
  services?: ServiceLineItem[];
  qty: number;
  original: number;
  paid: number;
  profitRecognized?: number;
  materialRecognized?: number;
  materialTotal?: number;
  stockUsed?: Array<{ name: string; qty: number }>;
  staff?: string;
  kind?: 'cyber' | 'gas' | 'electronics';
  gasId?: number;
  electronicsId?: number;
  payments?: DebtPaymentEntry[];
  lastPaymentDate?: string;
  shopId?: string;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  idNumber?: string;
  lastSeen?: string;
  notes?: string;
  totalSpent?: number;
  debtBalance?: number;
  visits?: number;
  points?: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  productsSupplied?: string;
  amountOwed?: number;
  notes?: string;
}

export interface AuditEntry {
  id: number;
  time: string;
  staff: string;
  action: string;
  details: string;
  ip?: string;
}

export interface FamilyExpense {
  id: string | number;
  date: string;
  name: string;
  amount: number;
  payment?: PaymentMethod;
  note?: string;
  staff?: string;
}

export interface FamilyIncomeManual {
  id: string | number;
  date: string;
  source: string;
  amount: number;
  note?: string;
}

export interface SalaryPayment {
  id: number;
  date: string;
  amount: number;
  payment: PaymentMethod;
  note?: string;
  staff: string;
}

export interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  tillNumber: string;
  environment: 'sandbox' | 'production';
  backendUrl?: string;
}

export interface ChatMessage {
  id?: string;
  from: 'staff' | 'customer';
  text: string;
  time: string;
  senderName?: string;
}

export interface AdCampaign {
  id: number;
  date: string;
  message: string;
  recipients: Array<{ name: string; phone: string }>;
}

export type GeneralUnit = 'Piece' | 'Packet' | 'Bottle' | 'Box' | 'Kg' | 'Gram' | 'Litre' | 'ml' | 'Dozen' | 'Other';

export interface GeneralProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  quantity: number;
  unit: GeneralUnit;
  minStock: number;
  supplier?: string;
  expiryDate?: string;
  active: boolean;
  shopId?: string;
}

export interface GeneralCategory {
  id: string;
  name: string;
  description?: string;
}

export interface GeneralSupplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  amountOwed?: number;
}

export interface GeneralPurchase {
  id: string;
  date: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  qty: number;
  buyingPrice: number;
  totalCost: number;
  staff: string;
  shopId?: string;
}

export interface GeneralSaleItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  buyingPrice: number;
  total: number;
  profit: number;
}

export interface GeneralSale {
  id: number;
  receipt: string;
  date: string;
  customer: string;
  phone?: string;
  items: GeneralSaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  profit: number;
  payment: PaymentMethod;
  staff: string;
  status?: 'completed' | 'cancelled';
  shopId?: string;
  taxRate?: number;
  taxAmount?: number;
  taxMode?: 'inclusive' | 'exclusive';
  taxName?: string;
}
