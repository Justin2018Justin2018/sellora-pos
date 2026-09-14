import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Transaction,
  StockItem,
  Expense,
  DebtRecord,
  Customer
} from '../types/pos';

// Read client credentials lazily from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns whether Supabase credentials have been provided via environment variables
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('placeholder')
  );
};

/**
 * Get current configured Supabase project URL (redacted for safe UI display)
 */
export const getSupabaseProjectDisplay = (): string => {
  if (!isSupabaseConfigured()) return 'Not Connected';
  try {
    const url = new URL(supabaseUrl);
    return url.hostname;
  } catch {
    return 'Configured';
  }
};

/**
 * Lazy initialization of Supabase client to avoid crashes if keys are not set
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Implicit flow (not PKCE): PKCE requires the confirmation
          // link to be opened in the exact same browser/tab that
          // started sign-up, storing a code verifier locally. On
          // mobile, email apps very often open links in a different
          // in-app browser/WebView, silently breaking that match and
          // leaving the account stuck "unconfirmed" even after the
          // link is clicked. Implicit flow puts the token directly in
          // the redirect URL instead, so confirmation works regardless
          // of which browser context opens the link.
          flowType: 'implicit',
        },
      });
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return supabaseInstance;
};

/**
 * ------------------------------------------------------------------
 * AUTH
 * ------------------------------------------------------------------
 * The RLS policies in supabase-schema-v2-security-fix.sql only grant
 * access to the `authenticated` role, scoped to rows the signed-in
 * user is a member of (via shop_members). These helpers wrap
 * Supabase Auth so the rest of the app never has to trust a
 * client-supplied shopId on its own - the database checks it too.
 * Claiming a shop_id (becoming its owner) is not a direct table
 * write either: it goes through the claim_shop() RPC, which only
 * lets the first signup for a given shop_id succeed, so a
 * client-supplied shopId can never be used to take over someone
 * else's shop.
 * ------------------------------------------------------------------
 */

export interface SupabaseAuthResult {
  success: boolean;
  message: string;
  userId?: string;
}

/** Returns the current signed-in Supabase user, or null if not signed in. */
export const getCurrentSupabaseUser = async () => {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user ?? null;
};

/**
 * Signs up a new shop owner/staff member and links them to a shop.
 * On first sign-up for a shop, this claims that shop_id for the user.
 */
export const signUpShopAccount = async (
  email: string,
  password: string,
  shopId: string
): Promise<SupabaseAuthResult> => {
  const client = getSupabase();
  if (!client) return { success: false, message: 'Supabase is not configured.' };

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { success: false, message: error.message };
  const userId = data.user?.id;
  if (!userId) {
    return {
      success: true,
      message: 'Account created. Check your email to confirm, then sign in.',
    };
  }

  // Claim this shop for the new user via a server-side function.
  // The database only allows the FIRST signup for a given shop_id to
  // become its owner (see claim_shop in supabase-schema-v2-security-fix.sql) -
  // a direct client-side insert/upsert into shop_members is blocked by RLS
  // and would let anyone claim any shop_id, so this must go through the RPC.
  const { error: memberError } = await client.rpc('claim_shop', {
    p_shop_id: shopId,
  });
  if (memberError) {
    return {
      success: false,
      message:
        memberError.message.includes('already claimed')
          ? 'This shop is already registered. Ask the shop owner to add you as staff instead of signing up again.'
          : `Account created but could not link to shop: ${memberError.message}`,
    };
  }

  return { success: true, message: 'Account created and linked to your shop.', userId };
};

/**
 * Requests a fresh confirmation email for an account that signed up but
 * hasn't confirmed yet. Uses the same redirect handling as sign-up so a
 * resent link behaves identically to the original one.
 */
export const resendConfirmationEmail = async (email: string): Promise<SupabaseAuthResult> => {
  const client = getSupabase();
  if (!client) return { success: false, message: 'Supabase is not configured.' };

  const { error } = await client.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Confirmation email sent. Please check your inbox (and spam folder).' };
};

/** Signs in an existing shop account. */
export const signInShopAccount = async (
  email: string,
  password: string
): Promise<SupabaseAuthResult> => {
  const client = getSupabase();
  if (!client) return { success: false, message: 'Supabase is not configured.' };

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Signed in.', userId: data.user?.id };
};

/** Signs the current user out of Supabase. */
export const signOutSupabaseUser = async (): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  await client.auth.signOut();
};

export interface ShopMembership {
  shopId: string;
  role: string;
}

/**
 * Looks up which shop (if any) the currently signed-in user belongs to,
 * via the shop_members table. This is what the login gate uses to decide
 * whether a signed-in user already has a shop, or needs to link/create one.
 * Relies on RLS (a user can only ever see their own shop_members row).
 */
export const getMyShopMembership = async (): Promise<ShopMembership | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data: userData } = await client.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;

  const { data, error } = await client
    .from('shop_members')
    .select('shop_id, role')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { shopId: data.shop_id as string, role: (data.role as string) || 'owner' };
};

/**
 * Links the currently signed-in user to a shop_id via the claim_shop RPC.
 * Used as a recovery path if a signup's automatic claim step failed, or for
 * a returning user whose account somehow has no shop_members row yet.
 * Same server-side guarantee as signUpShopAccount: only the first claimant
 * for a given shop_id succeeds.
 */
export const claimShopForCurrentUser = async (shopId: string): Promise<SupabaseAuthResult> => {
  const client = getSupabase();
  if (!client) return { success: false, message: 'Supabase is not configured.' };

  const { error } = await client.rpc('claim_shop', { p_shop_id: shopId });
  if (error) {
    return {
      success: false,
      message: error.message.includes('already claimed')
        ? 'That Shop ID is already registered to another account. Choose a different Shop ID, or ask that shop\'s owner to add you as staff.'
        : `Could not link shop: ${error.message}`,
    };
  }
  return { success: true, message: 'Shop linked to your account.' };
};

/**
 * Test connectivity with Supabase
 */
export const testSupabaseConnection = async (): Promise<{
  success: boolean;
  message: string;
  url?: string;
  tableReady?: boolean;
}> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Supabase URL or Anon Key is missing in environment (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).',
      url: supabaseUrl || undefined,
      tableReady: false,
    };
  }

  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'Could not create Supabase client instance.', tableReady: false };
  }

  try {
    const { error } = await client.from('pos_transactions').select('id').limit(1);
    if (error) {
      // If table pos_transactions does not exist yet
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Connected to Supabase! Run the provided SQL migration in Supabase SQL editor to create the POS tables.',
          url: supabaseUrl,
          tableReady: false,
        };
      }
      return {
        success: false,
        message: `Supabase error: ${error.message}`,
        url: supabaseUrl,
        tableReady: false,
      };
    }
    return {
      success: true,
      message: 'Connected to Supabase PostgreSQL database! Tables are online and ready.',
      url: supabaseUrl,
      tableReady: true,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Network error connecting to Supabase.',
      url: supabaseUrl,
      tableReady: false,
    };
  }
};

/**
 * Syncs a new transaction to Supabase
 */
export const syncTransactionToSupabase = async (
  tx: Transaction,
  shopId: string,
  businessType?: string
): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('pos_transactions').upsert({
      id: tx.id,
      receipt: tx.receipt,
      date: tx.date,
      customer: tx.customer,
      service: tx.service,
      qty: tx.qty,
      unit_price: tx.price,
      total: tx.total,
      payment: tx.payment,
      status: tx.status || 'completed',
      staff: tx.staff,
      notes: tx.notes || null,
      material_cost: tx.materialTotal || 0,
      shop_id: shopId,
      business_type: businessType || tx.businessType || 'cyber',
    });
    if (error) {
      console.warn('Failed to sync transaction to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing transaction to Supabase:', err);
    return false;
  }
};

/**
 * Syncs an expense to Supabase
 */
export const syncExpenseToSupabase = async (
  expense: Expense,
  shopId: string,
  businessType?: string
): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('pos_expenses').upsert({
      id: String(expense.id),
      date: expense.date,
      title: expense.desc,
      amount: expense.amount,
      category: expense.category || 'General',
      payment_method: expense.payment || 'Cash',
      recorded_by: expense.staff || 'Admin',
      shop_id: shopId,
      business_type: businessType || expense.businessType || 'cyber',
    });
    if (error) {
      console.warn('Failed to sync expense to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing expense to Supabase:', err);
    return false;
  }
};

/**
 * Syncs stock items to Supabase
 */
export const syncStockToSupabase = async (
  stockItems: StockItem[],
  shopId: string,
  businessType?: string
): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  try {
    const rows = stockItems.map((item) => ({
      id: item.id || item.name,
      name: item.name,
      category: item.category || 'Printing Materials',
      unit: item.unit,
      unit_cost: item.costPrice ?? item.costPerUnit ?? 0,
      retail_price: item.sellingPrice ?? 0,
      opening_stock: item.openingStock ?? 0,
      stock_added: item.stockAdded ?? 0,
      damaged_stock: 0,
      reorder_level: item.reorderLevel ?? 5,
      shop_id: shopId,
      business_type: businessType || item.businessType || 'cyber',
    }));

    const { error } = await client.from('pos_stock').upsert(rows);
    if (error) {
      console.warn('Failed to sync stock to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing stock to Supabase:', err);
    return false;
  }
};

/**
 * Syncs debts to Supabase
 */
export const syncDebtToSupabase = async (
  debt: DebtRecord,
  shopId: string,
  businessType?: string
): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('pos_debts').upsert({
      id: String(debt.id),
      customer_name: debt.name,
      customer_phone: debt.phone || null,
      original: debt.original,
      paid: debt.paid,
      service: debt.service,
      date: debt.date,
      status: debt.original - debt.paid <= 0 ? 'paid' : 'pending',
      staff: debt.staff || 'Admin',
      shop_id: shopId,
      business_type: businessType || debt.businessType || debt.kind || 'cyber',
    });
    if (error) {
      console.warn('Failed to sync debt to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing debt to Supabase:', err);
    return false;
  }
};

/**
 * Syncs a customer record to Supabase
 */
export const syncCustomerToSupabase = async (
  customer: Customer,
  shopId: string,
  businessType?: string
): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('pos_customers').upsert({
      id: customer.id || customer.phone,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || null,
      notes: customer.notes || null,
      loyalty_points: customer.points || 0,
      shop_id: shopId,
      business_type: businessType || customer.businessType || 'cyber',
    });
    if (error) {
      console.warn('Failed to sync customer to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing customer to Supabase:', err);
    return false;
  }
};

/**
 * Pull transactions from Supabase. Scoped to a single business_type
 * when provided so switching business mode never merges another
 * business's sales into the active one's view.
 */
export const fetchTransactionsFromSupabase = async (
  shopId?: string,
  businessType?: string
): Promise<Transaction[] | null> => {
  const client = getSupabase();
  if (!client) return null;

  try {
    let query = client.from('pos_transactions').select('*').order('id', { ascending: false });
    if (shopId) {
      query = query.eq('shop_id', shopId);
    }
    if (businessType) {
      query = query.eq('business_type', businessType);
    }
    const { data, error } = await query;
    if (error || !data) {
      return null;
    }

    return data.map((row: any) => ({
      id: Number(row.id),
      receipt: row.receipt,
      date: row.date,
      customer: row.customer,
      service: row.service,
      services: [],
      qty: Number(row.qty),
      price: Number(row.unit_price),
      subtotal: Number(row.total),
      total: Number(row.total),
      material: 0,
      materialTotal: Number(row.material_cost || 0),
      paid: Number(row.total),
      change: 0,
      profit: Number(row.total) - Number(row.material_cost || 0),
      payment: row.payment,
      staff: row.staff,
      notes: row.notes || undefined,
      status: row.status,
      businessType: row.business_type || undefined,
    }));
  } catch (err) {
    console.warn('Error fetching from Supabase:', err);
    return null;
  }
};

/**
 * Deletes a transaction from Supabase cloud database
 */
export const deleteTransactionFromSupabase = async (id: number): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('pos_transactions').delete().eq('id', id);
    if (error) {
      console.warn('Failed to delete transaction from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error deleting transaction from Supabase:', err);
    return false;
  }
};

