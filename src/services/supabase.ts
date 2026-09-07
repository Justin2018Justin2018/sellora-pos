import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Transaction,
  StockItem,
  Expense,
  DebtRecord,
  Customer
} from '../types/pos';

// Read client credentials lazily from environment.
// Supabase's dashboard now calls this the "publishable" key, but older
// projects/docs call it the "anon" key - they're the same kind of key,
// so accept either env var name.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

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

  const { data, error } = await client.auth.signUp({ email, password });
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
  shopId: string
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
  shopId: string
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
  shopId: string
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
  shopId: string
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
 * Pull transactions from Supabase
 */
export const fetchTransactionsFromSupabase = async (
  shopId?: string
): Promise<Transaction[] | null> => {
  const client = getSupabase();
  if (!client) return null;

  try {
    let query = client.from('pos_transactions').select('*').order('id', { ascending: false });
    if (shopId) {
      query = query.eq('shop_id', shopId);
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

