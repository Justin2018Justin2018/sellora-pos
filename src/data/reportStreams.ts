import { BusinessMode } from '../types/pos';

/**
 * Which underlying dataset a P&L revenue line is built from.
 *  - cyber       -> `transactions` (service / receipt sales)
 *  - gas         -> `gasTransactions` (cylinder refill module)
 *  - electronics -> `electronicsSales` (serial / warranty module)
 *  - general     -> `generalSales` (the product POS, which is what
 *                   restaurant, bar, pharmacy, clothing, shop, guest
 *                   house and "other" modes actually sell through)
 */
export type RevenueStreamKey = 'cyber' | 'gas' | 'electronics' | 'general';

export interface RevenueStreamConfig {
  key: RevenueStreamKey;
  /** Line item in section 1 (Total Revenue) */
  revenueLabel: string;
  /** Matching line item in section 2 (COGS) */
  cogsLabel: string;
  /** Short label used by the ledger tab + ledger row category */
  tabLabel: string;
  /** Badge shown on the ledger row ("Cyber", "Gas", "Kitchen"...) */
  badgeLabel: string;
  /** Noun for the record count: "12 sales", "12 orders", "12 refills" */
  unitLabel: string;
  /** Full Tailwind class strings (never build these dynamically — v4 scans source) */
  pillClass: string;
  tabActiveClass: string;
  tabCountClass: string;
  badgeClass: string;
}

const CYBER_STREAM: RevenueStreamConfig = {
  key: 'cyber',
  revenueLabel: 'Cyber, Printing & Photocopy Services',
  cogsLabel: 'Paper, Toner, Laminating Pouches & Envelopes',
  tabLabel: 'Cyber & POS',
  badgeLabel: 'Cyber',
  unitLabel: 'sales',
  pillClass:
    'px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800 hover:bg-blue-100 transition-colors',
  tabActiveClass: 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm',
  tabCountClass: 'px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300',
  badgeClass:
    'px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800',
};

const GAS_STREAM: RevenueStreamConfig = {
  key: 'gas',
  revenueLabel: 'Gas Cylinder Refills & Sales',
  cogsLabel: 'Wholesale Gas Refill Cylinder Purchases',
  tabLabel: 'Gas Refills',
  badgeLabel: 'Gas',
  unitLabel: 'refills',
  pillClass:
    'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800 hover:bg-amber-100 transition-colors',
  tabActiveClass: 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm',
  tabCountClass: 'px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
  badgeClass:
    'px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800',
};

const ELECTRONICS_STREAM: RevenueStreamConfig = {
  key: 'electronics',
  revenueLabel: 'Electronics & Phone Accessories',
  cogsLabel: 'Electronics Wholesale Inventory Purchases',
  tabLabel: 'Electronics',
  badgeLabel: 'Electronics',
  unitLabel: 'sales',
  pillClass:
    'px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800 hover:bg-purple-100 transition-colors',
  tabActiveClass: 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm',
  tabCountClass: 'px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300',
  badgeClass:
    'px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800',
};

/** Shared styling for the product-POS ("general") revenue line. */
const GENERAL_STYLE = {
  pillClass:
    'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 transition-colors',
  tabActiveClass: 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm',
  tabCountClass: 'px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
  badgeClass:
    'px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800',
};

type GeneralWording = Pick<
  RevenueStreamConfig,
  'revenueLabel' | 'cogsLabel' | 'tabLabel' | 'badgeLabel' | 'unitLabel'
>;

/**
 * Wording for the product-POS revenue line, per business type. This is the
 * line that carries ALL revenue for restaurant / bar / pharmacy / clothing /
 * shop / guest house / other, so it must read like that trade's own books.
 */
const GENERAL_WORDING: Record<BusinessMode, GeneralWording> = {
  restaurant: {
    revenueLabel: 'Food & Beverage Sales',
    cogsLabel: 'Food, Drinks & Kitchen Ingredient Purchases',
    tabLabel: 'Food & Drink',
    badgeLabel: 'Kitchen',
    unitLabel: 'orders',
  },
  bar: {
    revenueLabel: 'Bar, Drinks & Beverage Sales',
    cogsLabel: 'Beer, Spirits & Beverage Stock Purchases',
    tabLabel: 'Bar Sales',
    badgeLabel: 'Bar',
    unitLabel: 'orders',
  },
  pharmacy: {
    revenueLabel: 'Pharmacy, Medication & Health Product Sales',
    cogsLabel: 'Medicine & Medical Supplies Wholesale Purchases',
    tabLabel: 'Pharmacy',
    badgeLabel: 'Pharmacy',
    unitLabel: 'sales',
  },
  clothing: {
    revenueLabel: 'Clothing, Apparel & Footwear Sales',
    cogsLabel: 'Garment & Apparel Stock Purchases',
    tabLabel: 'Apparel',
    badgeLabel: 'Apparel',
    unitLabel: 'sales',
  },
  guest_house: {
    revenueLabel: 'Rooms, Lodging & Guest Services',
    cogsLabel: 'Housekeeping, Linen & Guest Consumables',
    tabLabel: 'Rooms & Guests',
    badgeLabel: 'Lodging',
    unitLabel: 'bookings',
  },
  general_shop: {
    revenueLabel: 'Shop Goods & Retail Sales',
    cogsLabel: 'Wholesale Goods & Restocking Purchases',
    tabLabel: 'Shop Sales',
    badgeLabel: 'Shop',
    unitLabel: 'sales',
  },
  other: {
    revenueLabel: 'Product & Service Sales',
    cogsLabel: 'Inventory & Direct Supplies Purchased',
    tabLabel: 'Sales',
    badgeLabel: 'Sale',
    unitLabel: 'sales',
  },
  // Modes below also run a dedicated module; the general line covers their
  // over-the-counter stock sales only.
  cyber: {
    revenueLabel: 'Stationery & Shop Product Sales',
    cogsLabel: 'Stationery & Shop Stock Purchases',
    tabLabel: 'Shop Sales',
    badgeLabel: 'Shop',
    unitLabel: 'sales',
  },
  gas: {
    revenueLabel: 'Accessories, Lubricants & Shop Sales',
    cogsLabel: 'Accessories & Lubricants Stock Purchases',
    tabLabel: 'Shop Sales',
    badgeLabel: 'Shop',
    unitLabel: 'sales',
  },
  electronics: {
    revenueLabel: 'Counter Stock & Accessory Sales',
    cogsLabel: 'Counter Stock Wholesale Purchases',
    tabLabel: 'Counter Sales',
    badgeLabel: 'Counter',
    unitLabel: 'sales',
  },
  all: {
    revenueLabel: 'Product & Retail Sales (All Counters)',
    cogsLabel: 'Inventory & Stock Purchases (All Counters)',
    tabLabel: 'Retail Sales',
    badgeLabel: 'Retail',
    unitLabel: 'sales',
  },
};

const generalStream = (mode: BusinessMode): RevenueStreamConfig => ({
  key: 'general',
  ...(GENERAL_WORDING[mode] || GENERAL_WORDING.other),
  ...GENERAL_STYLE,
});

/**
 * The revenue lines a given business type should actually see on its P&L.
 * A restaurant must never be shown gas or photocopy lines, and a cyber café
 * must never lose its service revenue line.
 */
export const getRevenueStreams = (mode: BusinessMode): RevenueStreamConfig[] => {
  switch (mode) {
    case 'cyber':
      return [CYBER_STREAM, generalStream(mode)];
    case 'gas':
      return [GAS_STREAM, generalStream(mode)];
    case 'electronics':
      return [ELECTRONICS_STREAM, generalStream(mode)];
    case 'all':
      return [CYBER_STREAM, GAS_STREAM, ELECTRONICS_STREAM, generalStream(mode)];
    default:
      return [generalStream(mode)];
  }
};
