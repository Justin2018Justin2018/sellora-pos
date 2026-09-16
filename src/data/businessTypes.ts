import { BusinessMode } from '../types/pos';

export interface BusinessTypeConfig {
  id: BusinessMode;
  name: string;
  shortName: string;
  emoji: string;
  badge: string;
  tagline: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number; // usually 10x monthly (2 months free)
  features: string[];
  themeColor: string;
  gradient: string;
  borderAccent: string;
  defaultCategories: { id: string; name: string }[];
  defaultSuppliers: { id: string; name: string; phone: string; email: string }[];
  defaultProducts: {
    id: string;
    name: string;
    sku: string;
    barcode: string;
    category: string;
    buyingPrice: number;
    sellingPrice: number;
    quantity: number;
    unit: 'Piece' | 'Kg' | 'Litre' | 'Packet' | 'Box' | 'Bottle' | 'Tin' | 'Sack' | 'Meter' | 'Pair';
    minStock: number;
    supplier: string;
    active: boolean;
  }[];
}

export const BUSINESS_TYPES: BusinessTypeConfig[] = [
  {
    id: 'cyber',
    name: 'Cyber Café & E-Services',
    shortName: 'Cyber Café',
    emoji: '🖥️',
    badge: 'Popular for Cyber',
    tagline: 'Printing, Photocopy, KRA, Government & Internet Services',
    description: 'Designed for cyber cafés, printing bureaus, stationery stores, and government e-service centers.',
    monthlyPrice: 1200,
    annualPrice: 12000,
    themeColor: 'blue',
    gradient: 'from-blue-600 via-indigo-600 to-cyan-700',
    borderAccent: 'border-blue-500',
    features: [
      'Multi-rate Service Catalog (Photocopy, Printing, KRA, Lamination)',
      'Material Auto-Deduction per service (Reams, Laminating pouches)',
      'Document Requests Queue with status tracking',
      'Instant Thermal Receipts (58mm, 80mm & A4 formal invoices)',
      'M-Pesa STK Push, Till & Cash payment recording',
      'Staff Cash Drawer Reconciliation & Shift Handover',
    ],
    defaultCategories: [
      { id: 'cat_c1', name: 'Printing & Photocopy' },
      { id: 'cat_c2', name: 'Stationery & Binding' },
      { id: 'cat_c3', name: 'Government Services' },
      { id: 'cat_c4', name: 'Digital Accessories' },
    ],
    defaultSuppliers: [
      { id: 'sup_c1', name: 'Stationery World CBD', phone: '0711000111', email: 'sales@stationeryworld.co.ke' },
      { id: 'sup_c2', name: 'Alpha Paper Distributors', phone: '0722333444', email: 'orders@alphapaper.co.ke' },
    ],
    defaultProducts: [
      { id: 'cyb_1', name: 'Photocopy Paper A4 (Ream)', sku: 'CYB-PAP-A4', barcode: '6161200001', category: 'Printing & Photocopy', buyingPrice: 650, sellingPrice: 850, quantity: 15, unit: 'Box', minStock: 3, supplier: 'Alpha Paper Distributors', active: true },
      { id: 'cyb_2', name: 'Laminating Pouch A4 (Pk 100)', sku: 'CYB-LAM-A4', barcode: '6161200002', category: 'Stationery & Binding', buyingPrice: 450, sellingPrice: 600, quantity: 8, unit: 'Packet', minStock: 2, supplier: 'Stationery World CBD', active: true },
      { id: 'cyb_3', name: 'Spiral Binding Coil (Box 100)', sku: 'CYB-SPR-10', barcode: '6161200003', category: 'Stationery & Binding', buyingPrice: 300, sellingPrice: 450, quantity: 10, unit: 'Box', minStock: 2, supplier: 'Stationery World CBD', active: true },
      { id: 'cyb_4', name: 'Flash Disk 32GB (SanDisk)', sku: 'CYB-FLS-32', barcode: '6161200004', category: 'Digital Accessories', buyingPrice: 600, sellingPrice: 900, quantity: 12, unit: 'Piece', minStock: 3, supplier: 'Stationery World CBD', active: true },
    ],
  },
  {
    id: 'gas',
    name: 'Gas / LPG Station & Fuel Hub',
    shortName: 'Gas / LPG Shop',
    emoji: '⛽',
    badge: 'Fuel & LPG POS',
    tagline: 'LPG Gas Refills, Complete Cylinders, Regulators & Burners',
    description: 'Built for gas cylinder retail outlets, LPG refill stations, petrol pump hubs, and lubricant depots.',
    monthlyPrice: 1500,
    annualPrice: 15000,
    themeColor: 'amber',
    gradient: 'from-amber-600 via-orange-600 to-yellow-700',
    borderAccent: 'border-amber-500',
    features: [
      'Gas Cylinder Exchange & Refill Tracker (6kg, 13kg, 22.5kg, 50kg)',
      'Empty vs Filled Cylinder Stock Count Audit',
      'Petroleum & Engine Lubricants Inventory Management',
      'Cylinder Brand Tracking (Total, K-Gas, Afrigas, Rubis, Taifa)',
      'Delivery & Safety Leakage Testing Logs',
      'Customer Credit / Debt Tracker with WhatsApp Receipts',
    ],
    defaultCategories: [
      { id: 'cat_g1', name: 'LPG Gas Cylinders' },
      { id: 'cat_g2', name: 'Petroleum / Fuel' },
      { id: 'cat_g3', name: 'Lubricants & Oils' },
      { id: 'cat_g4', name: 'Burners & Accessories' },
    ],
    defaultSuppliers: [
      { id: 'sup_g1', name: 'TotalEnergies Kenya', phone: '0700111222', email: 'orders@totalenergies.co.ke' },
      { id: 'sup_g2', name: 'Taifa Gas Depot', phone: '0733444555', email: 'sales@taifagas.co.ke' },
    ],
    defaultProducts: [
      { id: 'gas_1', name: 'LPG Gas Refill 6kg (Total/Taifa)', sku: 'GAS-REF-6KG', barcode: '6161300001', category: 'LPG Gas Cylinders', buyingPrice: 950, sellingPrice: 1150, quantity: 20, unit: 'Piece', minStock: 5, supplier: 'Taifa Gas Depot', active: true },
      { id: 'gas_2', name: 'LPG Gas Refill 13kg (Total/Taifa)', sku: 'GAS-REF-13KG', barcode: '6161300002', category: 'LPG Gas Cylinders', buyingPrice: 2400, sellingPrice: 2800, quantity: 10, unit: 'Piece', minStock: 3, supplier: 'TotalEnergies Kenya', active: true },
      { id: 'gas_3', name: 'Gas Regulator + Hose Pipe Kit', sku: 'GAS-REG-KIT', barcode: '6161300005', category: 'Burners & Accessories', buyingPrice: 850, sellingPrice: 1200, quantity: 8, unit: 'Piece', minStock: 2, supplier: 'Taifa Gas Depot', active: true },
      { id: 'gas_4', name: '2T Engine Oil 500ml', sku: 'GAS-OIL-2T', barcode: '6161300004', category: 'Lubricants & Oils', buyingPrice: 250, sellingPrice: 350, quantity: 15, unit: 'Bottle', minStock: 4, supplier: 'TotalEnergies Kenya', active: true },
    ],
  },
  {
    id: 'electronics',
    name: 'Electronics & Mobile Tech Shop',
    shortName: 'Electronics Shop',
    emoji: '📱',
    badge: 'Serial & Warranty',
    tagline: 'Smartphones, Audio Gear, Accessories & Repair Tickets',
    description: 'Specialized for smartphone dealers, electronics shops, phone accessories, and computer tech hubs.',
    monthlyPrice: 1800,
    annualPrice: 18000,
    themeColor: 'purple',
    gradient: 'from-purple-600 via-indigo-600 to-pink-700',
    borderAccent: 'border-purple-500',
    features: [
      'IMEI & Hardware Serial Number tracking per unit',
      'Warranty Period Management & Receipt Expiry Terms',
      'Phone Screen & Hardware Repair Intake Tracking',
      'Fast Barcode Scanning & Multi-Accessory Checkout',
      'Cost vs Selling Profit Margins Analyzer',
      'Supplier Restock Purchase Orders & Supplier Ledger',
    ],
    defaultCategories: [
      { id: 'cat_t1', name: 'Smartphones' },
      { id: 'cat_t2', name: 'Chargers & Cables' },
      { id: 'cat_t3', name: 'Power Banks' },
      { id: 'cat_t4', name: 'Audio & Earphones' },
      { id: 'cat_t5', name: 'Storage' },
    ],
    defaultSuppliers: [
      { id: 'sup_t1', name: 'Oraimo Kenya Ltd', phone: '0700222333', email: 'sales@oraimo.com' },
      { id: 'sup_t2', name: 'MobiParts Eastleigh', phone: '0711444555', email: 'mobiparts@gmail.com' },
    ],
    defaultProducts: [
      { id: 'el_1', name: 'Samsung Galaxy A15 128GB', sku: 'SM-A15-128', barcode: '880609123456', category: 'Smartphones', buyingPrice: 16500, sellingPrice: 18999, quantity: 6, unit: 'Piece', minStock: 2, supplier: 'MobiParts Eastleigh', active: true },
      { id: 'el_2', name: 'Oraimo Fast Charger Type-C (20W)', sku: 'OCW-U66S', barcode: '489518074521', category: 'Chargers & Cables', buyingPrice: 650, sellingPrice: 1000, quantity: 25, unit: 'Piece', minStock: 5, supplier: 'Oraimo Kenya Ltd', active: true },
      { id: 'el_3', name: 'Oraimo 20,000mAh Power Bank', sku: 'OPB-P204D', barcode: '489518074999', category: 'Power Banks', buyingPrice: 2100, sellingPrice: 2800, quantity: 12, unit: 'Piece', minStock: 3, supplier: 'Oraimo Kenya Ltd', active: true },
      { id: 'el_4', name: 'Wireless Bluetooth Earbuds', sku: 'TWS-AIR-PRO', barcode: '489518074333', category: 'Audio & Earphones', buyingPrice: 900, sellingPrice: 1500, quantity: 18, unit: 'Piece', minStock: 4, supplier: 'Oraimo Kenya Ltd', active: true },
    ],
  },
  {
    id: 'general_shop',
    name: 'General Retail Shop & Supermarket',
    shortName: 'General Shop',
    emoji: '🛒',
    badge: 'Fast FMCG POS',
    tagline: 'Groceries, Supermarkets, Mini-Marts & Wholesale Outlets',
    description: 'Optimized for fast-moving retail convenience stores, mini-markets, grocery shops, and wholesale kiosks.',
    monthlyPrice: 1400,
    annualPrice: 14000,
    themeColor: 'emerald',
    gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
    borderAccent: 'border-emerald-500',
    features: [
      'Rapid Barcode Scanning & Tap-to-Add Checkout Grid',
      'Inventory Stock Deduction & Low Stock Thresholds',
      'Stock Restocking Purchases & Supplier Payables',
      'Customer Credit (Daftari / Madeni) with Auto-Balances',
      'Daily Gross Profit & Margin Breakdown per Item',
      'Thermal Receipts, M-Pesa Till & Split Payments',
    ],
    defaultCategories: [
      { id: 'cat_gen_1', name: 'Food & Grains' },
      { id: 'cat_gen_2', name: 'Dairy & Bakery' },
      { id: 'cat_gen_3', name: 'Beverages' },
      { id: 'cat_gen_4', name: 'Household & Cleaning' },
      { id: 'cat_gen_5', name: 'Snacks & Confectionery' },
    ],
    defaultSuppliers: [
      { id: 'sup_gen_1', name: 'Nairobi Wholesale Grocers', phone: '0722100200', email: 'orders@nairobiwholesale.co.ke' },
      { id: 'sup_gen_2', name: 'ABC Distributors Ltd', phone: '0733500600', email: 'sales@abcdistributors.co.ke' },
      { id: 'sup_gen_3', name: 'BIDCO Africa Depot', phone: '0711900800', email: 'sales@bidco-africa.com' },
    ],
    defaultProducts: [
      { id: 'gp_1', name: 'Sugar 1kg', sku: 'SUG-1KG', barcode: '616110123401', category: 'Food & Grains', buyingPrice: 130, sellingPrice: 150, quantity: 50, unit: 'Kg', minStock: 10, supplier: 'Nairobi Wholesale Grocers', active: true },
      { id: 'gp_2', name: 'Milk 500ml (Fresh)', sku: 'MLK-500', barcode: '616110123402', category: 'Dairy & Bakery', buyingPrice: 55, sellingPrice: 65, quantity: 40, unit: 'Packet', minStock: 8, supplier: 'ABC Distributors Ltd', active: true },
      { id: 'gp_3', name: 'White Bread (Large)', sku: 'BRD-LGE', barcode: '616110123403', category: 'Dairy & Bakery', buyingPrice: 60, sellingPrice: 70, quantity: 25, unit: 'Piece', minStock: 5, supplier: 'ABC Distributors Ltd', active: true },
      { id: 'gp_4', name: 'Maize Flour 2kg (Jogoo)', sku: 'FLR-2KG', barcode: '616110123404', category: 'Food & Grains', buyingPrice: 170, sellingPrice: 195, quantity: 30, unit: 'Packet', minStock: 6, supplier: 'Nairobi Wholesale Grocers', active: true },
      { id: 'gp_5', name: 'Cooking Oil 1Ltr (Golden Fry)', sku: 'OIL-1L', barcode: '616110123406', category: 'Food & Grains', buyingPrice: 320, sellingPrice: 370, quantity: 20, unit: 'Litre', minStock: 5, supplier: 'BIDCO Africa Depot', active: true },
      { id: 'gp_6', name: 'Soda 500ml (Coca-Cola)', sku: 'SDA-500', barcode: '616110123407', category: 'Beverages', buyingPrice: 70, sellingPrice: 90, quantity: 48, unit: 'Bottle', minStock: 12, supplier: 'ABC Distributors Ltd', active: true },
    ],
  },
  {
    id: 'clothing',
    name: 'Clothing, Shoes & Fashion Boutique',
    shortName: 'Clothing/Fashion',
    emoji: '👕',
    badge: 'Boutique POS',
    tagline: 'Apparel, Footwear, Accessories, Sizes & Color Variants',
    description: 'Engineered for fashion boutiques, shoe stores, apparel shops, kids wear, and tailor retail studios.',
    monthlyPrice: 1500,
    annualPrice: 15000,
    themeColor: 'rose',
    gradient: 'from-rose-600 via-pink-600 to-purple-700',
    borderAccent: 'border-rose-500',
    features: [
      'Size (S, M, L, XL, XXL) & Color variant cataloging',
      'High-Margin Fashion Inventory & Seasonal Collections',
      'Customer Layaway (Lipa Pole Pole) & Debt Tracking',
      'Barcode Tags & Promotional Discount Sales',
      'Supplier Consignment & Restock Purchases',
      'Styling & Fitting Notes on Customer Profiles',
    ],
    defaultCategories: [
      { id: 'cat_clo_1', name: "Men's Wear" },
      { id: 'cat_clo_2', name: "Women's Fashion" },
      { id: 'cat_clo_3', name: 'Footwear & Shoes' },
      { id: 'cat_clo_4', name: 'Kids & Baby Wear' },
      { id: 'cat_clo_5', name: 'Bags & Accessories' },
    ],
    defaultSuppliers: [
      { id: 'sup_clo_1', name: 'Eastleigh Apparel Wholesalers', phone: '0722888999', email: 'eastleigh.apparel@gmail.com' },
      { id: 'sup_clo_2', name: 'Gikomba Fashion Imports', phone: '0733777888', email: 'gikomba.fashion@gmail.com' },
    ],
    defaultProducts: [
      { id: 'clo_1', name: 'Slim Fit Cotton Jeans (Blue)', sku: 'CLO-JNS-BLU', barcode: '6161500001', category: "Men's Wear", buyingPrice: 900, sellingPrice: 1500, quantity: 20, unit: 'Piece', minStock: 4, supplier: 'Eastleigh Apparel Wholesalers', active: true },
      { id: 'clo_2', name: 'Designer Floral Dress', sku: 'CLO-DRS-FLR', barcode: '6161500002', category: "Women's Fashion", buyingPrice: 1200, sellingPrice: 2000, quantity: 15, unit: 'Piece', minStock: 3, supplier: 'Eastleigh Apparel Wholesalers', active: true },
      { id: 'clo_3', name: 'Sneakers Casual Shoes (Size 40-44)', sku: 'CLO-SNK-CAS', barcode: '6161500003', category: 'Footwear & Shoes', buyingPrice: 1400, sellingPrice: 2300, quantity: 12, unit: 'Pair', minStock: 3, supplier: 'Gikomba Fashion Imports', active: true },
      { id: 'clo_4', name: 'Plain Round Neck T-Shirt', sku: 'CLO-TSH-RND', barcode: '6161500004', category: "Men's Wear", buyingPrice: 350, sellingPrice: 600, quantity: 30, unit: 'Piece', minStock: 6, supplier: 'Gikomba Fashion Imports', active: true },
      { id: 'clo_5', name: 'Leather Belt (Unisex)', sku: 'CLO-ACC-BLT', barcode: '6161500005', category: 'Bags & Accessories', buyingPrice: 250, sellingPrice: 500, quantity: 25, unit: 'Piece', minStock: 5, supplier: 'Eastleigh Apparel Wholesalers', active: true },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant, Cafe & Fast Food POS',
    shortName: 'Restaurant/Food',
    emoji: '🍽️',
    badge: 'Kitchen & Diners',
    tagline: 'Menu Orders, Takeaways, Drinks & Daily Ingredient Costing',
    description: 'Designed for food joints, fast food kiosks, cafes, bomas, bakeries, and dine-in restaurants.',
    monthlyPrice: 1800,
    annualPrice: 18000,
    themeColor: 'orange',
    gradient: 'from-orange-600 via-red-600 to-amber-700',
    borderAccent: 'border-orange-500',
    features: [
      'Visual Quick-Tap Food & Drink Menu Grid',
      'Dine-in Table Numbers & Takeaway Order Tags',
      'Daily Kitchen Ingredient & Gas Expense Tracking',
      'Fast Kitchen Order Printing & Customer Bill Receipts',
      'Waitstaff Shift Reconciliation & Cash Audit',
      'Gross Food Cost & Dish Profitability Analytics',
    ],
    defaultCategories: [
      { id: 'cat_res_1', name: 'Main Dishes' },
      { id: 'cat_res_2', name: 'Fast Food & Snacks' },
      { id: 'cat_res_3', name: 'Hot Beverages' },
      { id: 'cat_res_4', name: 'Cold Drinks & Juices' },
      { id: 'cat_res_5', name: 'Accompaniments' },
    ],
    defaultSuppliers: [
      { id: 'sup_res_1', name: 'City Market Fresh Butchery', phone: '0722444000', email: 'orders@citybutchery.co.ke' },
      { id: 'sup_res_2', name: 'Wakulima Vegetable Suppliers', phone: '0733111222', email: 'wakulima@gmail.com' },
    ],
    defaultProducts: [
      { id: 'res_1', name: 'Beef Stew + Ugali / Rice', sku: 'RES-BF-UGL', barcode: '6161600001', category: 'Main Dishes', buyingPrice: 140, sellingPrice: 250, quantity: 50, unit: 'Piece', minStock: 10, supplier: 'City Market Fresh Butchery', active: true },
      { id: 'res_2', name: 'Fried Chicken (Quarter) + Chips', sku: 'RES-CHK-CHP', barcode: '6161600002', category: 'Fast Food & Snacks', buyingPrice: 180, sellingPrice: 300, quantity: 30, unit: 'Piece', minStock: 5, supplier: 'City Market Fresh Butchery', active: true },
      { id: 'res_3', name: 'Chips / French Fries (Plate)', sku: 'RES-CHP-PLT', barcode: '6161600003', category: 'Fast Food & Snacks', buyingPrice: 60, sellingPrice: 120, quantity: 40, unit: 'Piece', minStock: 8, supplier: 'Wakulima Vegetable Suppliers', active: true },
      { id: 'res_4', name: 'African Tea (Pot/Cup)', sku: 'RES-TEA-CUP', barcode: '6161600004', category: 'Hot Beverages', buyingPrice: 15, sellingPrice: 40, quantity: 100, unit: 'Piece', minStock: 20, supplier: 'Wakulima Vegetable Suppliers', active: true },
      { id: 'res_5', name: 'Fresh Tropical Fruit Juice (Glass)', sku: 'RES-JCE-GLS', barcode: '6161600005', category: 'Cold Drinks & Juices', buyingPrice: 35, sellingPrice: 80, quantity: 35, unit: 'Piece', minStock: 10, supplier: 'Wakulima Vegetable Suppliers', active: true },
    ],
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy & Chemist Health POS',
    shortName: 'Pharmacy',
    emoji: '💊',
    badge: 'Clinical & Health',
    tagline: 'Medicines, Dosage, Batch Numbers & Expiry Tracking',
    description: 'Built for community pharmacies, drugstores, chemists, clinics, and herbal health wellness dispensaries.',
    monthlyPrice: 2000,
    annualPrice: 20000,
    themeColor: 'teal',
    gradient: 'from-teal-600 via-cyan-600 to-emerald-700',
    borderAccent: 'border-teal-500',
    features: [
      'Batch Number & Medication Expiry Date Tracking',
      'Dosage Instructions printed on thermal receipts',
      'Prescription & Over-The-Counter (OTC) medicine organization',
      'Supplier Invoicing & Pharmaceutical Restock Orders',
      'Emergency & Fast Medicine Search by Brand or Generic Name',
      'Detailed Customer Health History & Credit Tracking',
    ],
    defaultCategories: [
      { id: 'cat_phm_1', name: 'Pain Relief & Fever' },
      { id: 'cat_phm_2', name: 'Antibiotics & Prescription' },
      { id: 'cat_phm_3', name: 'Cough, Cold & Allergies' },
      { id: 'cat_phm_4', name: 'Vitamins & Supplements' },
      { id: 'cat_phm_5', name: 'First Aid & Surgical' },
    ],
    defaultSuppliers: [
      { id: 'sup_phm_1', name: 'Laborex Kenya Ltd', phone: '0700888111', email: 'orders@laborex-kenya.com' },
      { id: 'sup_phm_2', name: 'Harleys Pharmaceuticals', phone: '0722555666', email: 'sales@harleys.co.ke' },
    ],
    defaultProducts: [
      { id: 'phm_1', name: 'Panadol Extra (Strip of 10)', sku: 'PHM-PAN-EXT', barcode: '6161700001', category: 'Pain Relief & Fever', buyingPrice: 70, sellingPrice: 100, quantity: 50, unit: 'Packet', minStock: 10, supplier: 'Laborex Kenya Ltd', active: true },
      { id: 'phm_2', name: 'Amoxicillin 500mg (Cap Strip)', sku: 'PHM-AMX-500', barcode: '6161700002', category: 'Antibiotics & Prescription', buyingPrice: 120, sellingPrice: 180, quantity: 30, unit: 'Packet', minStock: 8, supplier: 'Harleys Pharmaceuticals', active: true },
      { id: 'phm_3', name: 'Ascoril Cough Syrup 100ml', sku: 'PHM-ASC-SYR', barcode: '6161700003', category: 'Cough, Cold & Allergies', buyingPrice: 280, sellingPrice: 380, quantity: 15, unit: 'Bottle', minStock: 4, supplier: 'Laborex Kenya Ltd', active: true },
      { id: 'phm_4', name: 'Vitamin C 1000mg Effervescent (Tube)', sku: 'PHM-VIT-C1K', barcode: '6161700004', category: 'Vitamins & Supplements', buyingPrice: 350, sellingPrice: 500, quantity: 20, unit: 'Tube' as any, minStock: 5, supplier: 'Harleys Pharmaceuticals', active: true },
      { id: 'phm_5', name: 'Antiseptic Liquid 250ml (Dettol)', sku: 'PHM-DET-250', barcode: '6161700005', category: 'First Aid & Surgical', buyingPrice: 240, sellingPrice: 320, quantity: 18, unit: 'Bottle', minStock: 4, supplier: 'Harleys Pharmaceuticals', active: true },
    ],
  },
  {
    id: 'other',
    name: 'Specialty Shop & Custom Business',
    shortName: 'Specialty / Other',
    emoji: '📦',
    badge: 'Customizable POS',
    tagline: 'Hardware, Cosmetics, Auto Spares, Liquor & Trade',
    description: 'Versatile commercial retail engine that adapts to hardware stores, bookshops, agro-vets, or custom trade.',
    monthlyPrice: 1400,
    annualPrice: 14000,
    themeColor: 'slate',
    gradient: 'from-slate-700 via-slate-800 to-zinc-900',
    borderAccent: 'border-slate-500',
    features: [
      'Fully customizable product inventory and units',
      'Barcode point of sale & fast manual lookup',
      'Supplier purchase orders & restock invoices',
      'Customer credit management with payment reminders',
      'Daily, weekly and monthly profit accounting',
      'Data export to Excel/CSV and thermal receipt printing',
    ],
    defaultCategories: [
      { id: 'cat_oth_1', name: 'General Hardware' },
      { id: 'cat_oth_2', name: 'Tools & Equipment' },
      { id: 'cat_oth_3', name: 'Paints & Finishes' },
      { id: 'cat_oth_4', name: 'Fasteners & Nails' },
    ],
    defaultSuppliers: [
      { id: 'sup_oth_1', name: 'Industrial Area Hardware Depot', phone: '0722333777', email: 'sales@industrialhardware.co.ke' },
    ],
    defaultProducts: [
      { id: 'oth_1', name: 'Cement 50kg (Bamburi)', sku: 'OTH-BAM-50', barcode: '6161800001', category: 'General Hardware', buyingPrice: 650, sellingPrice: 750, quantity: 40, unit: 'Sack', minStock: 10, supplier: 'Industrial Area Hardware Depot', active: true },
      { id: 'oth_2', name: 'Claw Hammer 16oz (Steel)', sku: 'OTH-HAM-16', barcode: '6161800002', category: 'Tools & Equipment', buyingPrice: 450, sellingPrice: 700, quantity: 12, unit: 'Piece', minStock: 3, supplier: 'Industrial Area Hardware Depot', active: true },
      { id: 'oth_3', name: 'Gloss Paint 4L (Crown Paints)', sku: 'OTH-PNT-4L', barcode: '6161800003', category: 'Paints & Finishes', buyingPrice: 1800, sellingPrice: 2300, quantity: 8, unit: 'Tin', minStock: 2, supplier: 'Industrial Area Hardware Depot', active: true },
      { id: 'oth_4', name: 'Steel Wire Nails 3-inch (1kg)', sku: 'OTH-NAL-3IN', barcode: '6161800004', category: 'Fasteners & Nails', buyingPrice: 120, sellingPrice: 180, quantity: 50, unit: 'Kg', minStock: 10, supplier: 'Industrial Area Hardware Depot', active: true },
    ],
  },
  {
    id: 'all',
    name: 'All-in-One Multi-Business Suite',
    shortName: 'All-in-One Suite',
    emoji: '🌟',
    badge: 'Full Enterprise Unlocked',
    tagline: 'Cyber + Gas Station + Electronics Hub + Retail Shop + AI Advisor',
    description: 'The master commercial suite combining ALL industry modules together. Ideal for multi-business enterprises and owners who run Cyber, Gas, Tech, and Retail under one roof!',
    monthlyPrice: 2800,
    annualPrice: 28000,
    themeColor: 'blue',
    gradient: 'from-blue-700 via-purple-700 to-indigo-900',
    borderAccent: 'border-blue-500 ring-2 ring-blue-500/30',
    features: [
      'EVERY INDUSTRY MODULE UNLOCKED SIMULTANEOUSLY',
      'Cyber Printing Services with Auto-Deductible Reams',
      'Gas Station Hub with LPG Cylinder Refill Audits',
      'Electronics Hub with Serial Numbers & Warranties',
      'General Retail FMCG Catalog with Barcode Scanner',
      'Sellora AI Business Advisor & Profit Optimizer',
      'Family Finance Ledger, Owner Drawings & School Fees',
      'SMS Promotional Campaigns & Customer CRM',
      'Multi-Branch Shop Switcher & Super Admin Portal',
    ],
    defaultCategories: [
      { id: 'cat_all_1', name: 'Cyber & Documents' },
      { id: 'cat_all_2', name: 'Gas & Fuel' },
      { id: 'cat_all_3', name: 'Electronics & Phones' },
      { id: 'cat_all_4', name: 'General Merchandise' },
    ],
    defaultSuppliers: [
      { id: 'sup_all_1', name: 'TotalEnergies Kenya', phone: '0700111222', email: 'orders@totalenergies.co.ke' },
      { id: 'sup_all_2', name: 'Oraimo Kenya Ltd', phone: '0700222333', email: 'sales@oraimo.com' },
      { id: 'sup_all_3', name: 'Stationery World CBD', phone: '0711000111', email: 'sales@stationeryworld.co.ke' },
    ],
    defaultProducts: [
      { id: 'all_1', name: 'Photocopy Paper A4 (Ream)', sku: 'CYB-PAP-A4', barcode: '6161200001', category: 'Cyber & Documents', buyingPrice: 650, sellingPrice: 850, quantity: 15, unit: 'Box', minStock: 3, supplier: 'Stationery World CBD', active: true },
      { id: 'all_2', name: 'LPG Gas Refill 6kg (Total/Taifa)', sku: 'GAS-REF-6KG', barcode: '6161300001', category: 'Gas & Fuel', buyingPrice: 950, sellingPrice: 1150, quantity: 20, unit: 'Piece', minStock: 5, supplier: 'TotalEnergies Kenya', active: true },
      { id: 'all_3', name: 'Oraimo Fast Charger Type-C', sku: 'OCW-U66S', barcode: '489518074521', category: 'Electronics & Phones', buyingPrice: 650, sellingPrice: 1000, quantity: 25, unit: 'Piece', minStock: 5, supplier: 'Oraimo Kenya Ltd', active: true },
      { id: 'all_4', name: 'Sugar 1kg (Kabras)', sku: 'SUG-1KG', barcode: '616110123401', category: 'General Merchandise', buyingPrice: 130, sellingPrice: 150, quantity: 50, unit: 'Kg', minStock: 10, supplier: 'Stationery World CBD', active: true },
    ],
  },
  {
    id: 'bar',
    name: 'Bar, Pub & Lounge POS',
    shortName: 'Bar/Pub',
    emoji: '🍻',
    badge: 'Bars & Lounges',
    tagline: 'Drinks Menu, Crates, Bar Tabs & Nightly Cash Reconciliation',
    description: 'Designed for bars, pubs, lounges, wines & spirits outlets, and entertainment joints.',
    monthlyPrice: 1800,
    annualPrice: 18000,
    themeColor: 'amber',
    gradient: 'from-amber-600 via-orange-600 to-red-700',
    borderAccent: 'border-amber-500',
    features: [
      'Visual Quick-Tap Drinks Menu Grid',
      'Crate & Bottle-Level Stock Tracking',
      'Open Bar Tabs by Table or Customer Name',
      'Fast Bar Receipt Printing',
      'Bartender Shift Reconciliation & Cash Audit',
      'Drink-by-Drink Profitability Analytics',
    ],
    defaultCategories: [
      { id: 'cat_bar_1', name: 'Beer & Cider' },
      { id: 'cat_bar_2', name: 'Spirits & Whisky' },
      { id: 'cat_bar_3', name: 'Wines' },
      { id: 'cat_bar_4', name: 'Soft Drinks & Mixers' },
      { id: 'cat_bar_5', name: 'Bar Snacks' },
    ],
    defaultSuppliers: [
      { id: 'sup_bar_1', name: 'EABL Distributors Nairobi', phone: '0722555000', email: 'orders@eabldist.co.ke' },
      { id: 'sup_bar_2', name: 'Keroche Breweries Agents', phone: '0733222111', email: 'sales@kerochebrew.co.ke' },
    ],
    defaultProducts: [
      { id: 'bar_1', name: 'Tusker Lager (500ml Bottle)', sku: 'BAR-TSK-500', barcode: '6161700001', category: 'Beer & Cider', buyingPrice: 180, sellingPrice: 250, quantity: 96, unit: 'Bottle', minStock: 24, supplier: 'EABL Distributors Nairobi', active: true },
      { id: 'bar_2', name: 'Guinness Smooth (500ml Bottle)', sku: 'BAR-GNS-500', barcode: '6161700002', category: 'Beer & Cider', buyingPrice: 200, sellingPrice: 280, quantity: 72, unit: 'Bottle', minStock: 24, supplier: 'EABL Distributors Nairobi', active: true },
      { id: 'bar_3', name: 'Kenya Cane (250ml)', sku: 'BAR-KCN-250', barcode: '6161700003', category: 'Spirits & Whisky', buyingPrice: 250, sellingPrice: 400, quantity: 24, unit: 'Bottle', minStock: 6, supplier: 'Keroche Breweries Agents', active: true },
      { id: 'bar_4', name: 'Four Cousins Wine (750ml)', sku: 'BAR-4CS-750', barcode: '6161700004', category: 'Wines', buyingPrice: 650, sellingPrice: 950, quantity: 18, unit: 'Bottle', minStock: 4, supplier: 'Keroche Breweries Agents', active: true },
      { id: 'bar_5', name: 'Soda 300ml (Mixer)', sku: 'BAR-SDA-300', barcode: '6161700005', category: 'Soft Drinks & Mixers', buyingPrice: 35, sellingPrice: 70, quantity: 60, unit: 'Bottle', minStock: 12, supplier: 'EABL Distributors Nairobi', active: true },
      { id: 'bar_6', name: 'Smokie / Sausage (Bar Snack)', sku: 'BAR-SMK-PC', barcode: '6161700006', category: 'Bar Snacks', buyingPrice: 30, sellingPrice: 70, quantity: 40, unit: 'Piece', minStock: 10, supplier: 'EABL Distributors Nairobi', active: true },
    ],
  },
  {
    id: 'guest_house',
    name: 'Guest House & Lodging POS',
    shortName: 'Guest House',
    emoji: '🏨',
    badge: 'Guest Houses & Lodges',
    tagline: 'Room Bookings, Nightly Rates, Extras & Occupancy Tracking',
    description: 'Designed for guest houses, lodges, short-stay apartments, and small hotels.',
    monthlyPrice: 2000,
    annualPrice: 20000,
    themeColor: 'teal',
    gradient: 'from-teal-600 via-cyan-600 to-emerald-700',
    borderAccent: 'border-teal-500',
    features: [
      'Room/Unit Booking as a Sellable Service',
      'Nightly, Weekly & Extended-Stay Rate Cards',
      'Guest Folio: Room + Extras (Food, Laundry, Drinks) in One Bill',
      'Fast Booking Receipt Printing',
      'Front Desk Shift Reconciliation & Cash Audit',
      'Occupancy & Revenue-per-Room Analytics',
    ],
    defaultCategories: [
      { id: 'cat_gh_1', name: 'Room Bookings' },
      { id: 'cat_gh_2', name: 'Extended Stay Packages' },
      { id: 'cat_gh_3', name: 'Guest Extras' },
      { id: 'cat_gh_4', name: 'Laundry Services' },
      { id: 'cat_gh_5', name: 'Conference & Events' },
    ],
    defaultSuppliers: [
      { id: 'sup_gh_1', name: 'CleanStay Linen & Laundry Services', phone: '0722666000', email: 'orders@cleanstay.co.ke' },
      { id: 'sup_gh_2', name: 'Housekeeping Supplies Kenya', phone: '0733333222', email: 'sales@hksupplies.co.ke' },
    ],
    defaultProducts: [
      { id: 'gh_1', name: 'Standard Single Room (Per Night)', sku: 'GH-STD-NGT', barcode: '6161800001', category: 'Room Bookings', buyingPrice: 800, sellingPrice: 2000, quantity: 999, unit: 'Piece', minStock: 0, supplier: 'CleanStay Linen & Laundry Services', active: true },
      { id: 'gh_2', name: 'Deluxe Double Room (Per Night)', sku: 'GH-DLX-NGT', barcode: '6161800002', category: 'Room Bookings', buyingPrice: 1200, sellingPrice: 3500, quantity: 999, unit: 'Piece', minStock: 0, supplier: 'CleanStay Linen & Laundry Services', active: true },
      { id: 'gh_3', name: 'Weekly Stay Package', sku: 'GH-WK-PKG', barcode: '6161800003', category: 'Extended Stay Packages', buyingPrice: 5000, sellingPrice: 12000, quantity: 999, unit: 'Piece', minStock: 0, supplier: 'CleanStay Linen & Laundry Services', active: true },
      { id: 'gh_4', name: 'Breakfast (Guest Extra)', sku: 'GH-BRKF-EXT', barcode: '6161800004', category: 'Guest Extras', buyingPrice: 150, sellingPrice: 350, quantity: 999, unit: 'Piece', minStock: 0, supplier: 'Housekeeping Supplies Kenya', active: true },
      { id: 'gh_5', name: 'Laundry Service (Per Load)', sku: 'GH-LDY-LOAD', barcode: '6161800005', category: 'Laundry Services', buyingPrice: 100, sellingPrice: 250, quantity: 999, unit: 'Piece', minStock: 0, supplier: 'CleanStay Linen & Laundry Services', active: true },
    ],
  },
];

export const CUSTOM_PRICING_KEY = 'mj_custom_subscription_prices';

export interface CustomPlanPricingItem {
  monthlyPrice: number;
  annualPrice: number;
}

export type CustomPlanPricingMap = Record<string, CustomPlanPricingItem>;

export function getCustomPlanPricing(): CustomPlanPricingMap {
  try {
    const raw = localStorage.getItem(CUSTOM_PRICING_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse custom subscription pricing:', e);
    return {};
  }
}

export function saveCustomPlanPricing(pricing: CustomPlanPricingMap): void {
  try {
    localStorage.setItem(CUSTOM_PRICING_KEY, JSON.stringify(pricing));
    window.dispatchEvent(new CustomEvent('mj_pricing_updated', { detail: pricing }));
  } catch (e) {
    console.error('Failed to save custom subscription pricing:', e);
  }
}

export function updateCustomPlanPrice(planId: string, monthly: number, annual?: number): void {
  const current = getCustomPlanPricing();
  current[planId] = {
    monthlyPrice: Math.max(0, Math.round(monthly)),
    annualPrice: annual !== undefined ? Math.max(0, Math.round(annual)) : Math.max(0, Math.round(monthly * 10)),
  };
  saveCustomPlanPricing(current);
}

export function resetCustomPlanPricing(): void {
  try {
    localStorage.removeItem(CUSTOM_PRICING_KEY);
    window.dispatchEvent(new CustomEvent('mj_pricing_updated', { detail: {} }));
  } catch (e) {
    console.error('Failed to reset custom subscription pricing:', e);
  }
}

export function getBusinessTypes(): BusinessTypeConfig[] {
  const customPricing = getCustomPlanPricing();
  return BUSINESS_TYPES.map((b) => {
    const custom = customPricing[b.id];
    if (custom) {
      return {
        ...b,
        monthlyPrice: custom.monthlyPrice !== undefined ? custom.monthlyPrice : b.monthlyPrice,
        annualPrice: custom.annualPrice !== undefined ? custom.annualPrice : b.annualPrice,
      };
    }
    return b;
  });
}

export function getBusinessTypeConfig(mode?: BusinessMode): BusinessTypeConfig {
  const all = getBusinessTypes();
  const found = all.find((b) => b.id === mode);
  return found || all[0]; // fallback to cyber
}

