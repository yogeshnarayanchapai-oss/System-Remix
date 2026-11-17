import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { NetworthGroup, NetworthType } from '@/lib/networthFormat';
import { useAuth } from './useAuth';

export interface NetworthCategory {
  id: string;
  name: string;
  type: NetworthType;
  group_name: NetworthGroup;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetworthSubcategory {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NetworthEntry {
  id: string;
  entry_date: string;
  type: NetworthType;
  category_id: string | null;
  category_name: string;
  subcategory_id: string | null;
  subcategory_name: string | null;
  amount_npr: number;
  description: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetworthSettings {
  id: string;
  goal_start_npr: number;
  goal_target_npr: number;
  goal_label: string;
  usd_npr_rate: number;
  usd_npr_updated_at: string | null;
  updated_at: string;
}

interface NetworthBalanceEvent {
  date: string;
  delta: number;
}

export interface NetworthWalletHistory {
  usdOpeningBalance: number;
  usdEvents: NetworthBalanceEvent[];
  nprOpeningBalance: number;
  nprEvents: NetworthBalanceEvent[];
}

async function fetchNetworthPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}

/**
 * Rebuilds USD and NPR wallet balances at any past date from opening balances
 * and dated transactions/transfers. The configured USD rate is applied by the
 * dashboard because the project does not store historical exchange rates.
 */
export function useNetworthWalletHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['networth-wallet-history', user?.id],
    staleTime: 30_000,
    queryFn: async (): Promise<NetworthWalletHistory> => {
      const [usdAccounts, usdTransactions, usdTransfers, nprAccounts, nprEntries] = await Promise.all([
        fetchNetworthPages((from, to) => supabase
          .from('paypal_accounts')
          .select('id, opening_balance_amount')
          .order('id')
          .range(from, to)),
        fetchNetworthPages((from, to) => supabase
          .from('transactions')
          .select('id, paypal_account_id, txn_date, txn_type, amount')
          .order('txn_date')
          .order('id')
          .range(from, to)),
        fetchNetworthPages((from, to) => supabase
          .from('wallet_transfers')
          .select('id, from_wallet_id, to_wallet_id, transfer_date, amount, total')
          .order('transfer_date')
          .order('id')
          .range(from, to)),
        fetchNetworthPages((from, to) => supabase
          .from('nepali_accounts')
          .select('id, opening_balance_npr, status')
          .eq('status', 'ACTIVE')
          .order('id')
          .range(from, to)),
        fetchNetworthPages((from, to) => supabase
          .from('nepali_account_ledger')
          .select('id, nepali_account_id, entry_date, entry_type, amount_npr')
          .order('entry_date')
          .order('id')
          .range(from, to)),
      ]);

      const activeNprIds = new Set(nprAccounts.map((account) => account.id));
      const usdEvents: NetworthBalanceEvent[] = [];
      for (const transaction of usdTransactions) {
        if (!transaction.paypal_account_id) continue;
        const amount = Number(transaction.amount) || 0;
        usdEvents.push({
          date: transaction.txn_date,
          delta: transaction.txn_type === 'INCOMING' ? amount : -amount,
        });
      }
      for (const transfer of usdTransfers) {
        const amount = Number(transfer.amount) || 0;
        if (transfer.from_wallet_id) {
          usdEvents.push({
            date: transfer.transfer_date,
            delta: -(Number(transfer.total ?? amount) || 0),
          });
        }
        if (transfer.to_wallet_id) {
          usdEvents.push({ date: transfer.transfer_date, delta: amount });
        }
      }

      const nprEvents: NetworthBalanceEvent[] = [];
      for (const entry of nprEntries) {
        if (!entry.nepali_account_id || !activeNprIds.has(entry.nepali_account_id)) continue;
        const amount = Number(entry.amount_npr) || 0;
        nprEvents.push({
          date: entry.entry_date,
          delta: entry.entry_type === 'CREDIT' || entry.entry_type === 'TRANSFER_IN' ? amount : -amount,
        });
      }

      return {
        usdOpeningBalance: usdAccounts.reduce((sum, account) => sum + (Number(account.opening_balance_amount) || 0), 0),
        usdEvents,
        nprOpeningBalance: nprAccounts.reduce((sum, account) => sum + (Number(account.opening_balance_npr) || 0), 0),
        nprEvents,
      };
    },
  });
}

// Activity log helper for Net Worth actions
async function logNwActivity(action: string, entityType: string, entityId: string, meta?: Record<string, unknown>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_activity_logs').insert([{
      user_id: user.id,
      user_email: user.email || 'unknown',
      action,
      entity_type: entityType,
      entity_id: entityId,
      meta: meta ? (meta as never) : null,
    }]);
  } catch (e) {
    console.error('Net Worth activity log failed', e);
  }
}

// ---------- Categories ----------
export function useNetworthCategories() {
  return useQuery({
    queryKey: ['networth-categories'],
    queryFn: async (): Promise<NetworthCategory[]> => {
      const { data, error } = await supabase
        .from('networth_categories')
        .select('*')
        .order('group_name')
        .order('name');
      if (error) throw error;
      return (data || []) as NetworthCategory[];
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Partial<NetworthCategory> & { id?: string }) => {
      if (cat.id) {
        const { error } = await supabase
          .from('networth_categories')
          .update({
            name: cat.name,
            type: cat.type,
            group_name: cat.group_name,
            is_active: cat.is_active ?? true,
          })
          .eq('id', cat.id);
        if (error) throw error;
        await logNwActivity('NETWORTH_CATEGORY_UPDATE', 'networth_category', cat.id, {
          name: cat.name, type: cat.type, group_name: cat.group_name,
        });
      } else {
        const { data, error } = await supabase.from('networth_categories').insert({
          name: cat.name!,
          type: cat.type!,
          group_name: cat.group_name!,
        }).select().single();
        if (error) throw error;
        await logNwActivity('NETWORTH_CATEGORY_CREATE', 'networth_category', data.id, {
          name: cat.name, type: cat.type, group_name: cat.group_name,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networth-categories'] });
      toast.success('Category saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // capture name for log
      const { data: existing } = await supabase
        .from('networth_categories').select('name,type').eq('id', id).maybeSingle();
      const { error } = await supabase.from('networth_categories').delete().eq('id', id);
      if (error) throw error;
      await logNwActivity('NETWORTH_CATEGORY_DELETE', 'networth_category', id, {
        name: existing?.name, type: existing?.type,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networth-categories'] });
      toast.success('Category deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Subcategories ----------
export function useNetworthSubcategories() {
  return useQuery({
    queryKey: ['networth-subcategories'],
    queryFn: async (): Promise<NetworthSubcategory[]> => {
      const { data, error } = await supabase
        .from('networth_subcategories' as never)
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as NetworthSubcategory[];
    },
  });
}

export function useSaveSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { id?: string; category_id: string; name: string; is_active?: boolean }) => {
      if (s.id) {
        const { error } = await supabase
          .from('networth_subcategories' as never)
          .update({ name: s.name, category_id: s.category_id, is_active: s.is_active ?? true } as never)
          .eq('id', s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('networth_subcategories' as never)
          .insert({ name: s.name, category_id: s.category_id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networth-subcategories'] });
      toast.success('Subcategory saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('networth_subcategories' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networth-subcategories'] });
      toast.success('Subcategory deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Entries ----------
export function useNetworthEntries() {
  return useQuery({
    queryKey: ['networth-entries'],
    queryFn: async (): Promise<NetworthEntry[]> => {
      const all: NetworthEntry[] = [];
      let from = 0;
      const size = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('networth_entries')
          .select('*')
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + size - 1);
        if (error) throw error;
        const rows = (data || []) as NetworthEntry[];
        all.push(...rows);
        if (rows.length < size) break;
        from += size;
      }
      return all;
    },
  });
}

export function useSaveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Partial<NetworthEntry> & { id?: string }) => {
      if (entry.id) {
        const { error } = await supabase
          .from('networth_entries')
          .update({
            entry_date: entry.entry_date,
            type: entry.type,
            category_id: entry.category_id,
            category_name: entry.category_name,
            subcategory_id: entry.subcategory_id ?? null,
            subcategory_name: entry.subcategory_name ?? null,
            amount_npr: entry.amount_npr,
            description: entry.description,
            source: entry.source,
          } as never)
          .eq('id', entry.id);
        if (error) throw error;
        await logNwActivity('NETWORTH_ENTRY_UPDATE', 'networth_entry', entry.id, {
          entry_date: entry.entry_date, type: entry.type,
          category_name: entry.category_name, amount_npr: entry.amount_npr,
          description: entry.description,
        });
      } else {
        const { data, error } = await supabase.from('networth_entries').insert({
          entry_date: entry.entry_date!,
          type: entry.type!,
          category_id: entry.category_id,
          category_name: entry.category_name!,
          subcategory_id: entry.subcategory_id ?? null,
          subcategory_name: entry.subcategory_name ?? null,
          amount_npr: entry.amount_npr!,
          description: entry.description,
          source: entry.source,
        } as never).select().single();
        if (error) throw error;
        await logNwActivity('NETWORTH_ENTRY_CREATE', 'networth_entry', data.id, {
          entry_date: entry.entry_date, type: entry.type,
          category_name: entry.category_name, amount_npr: entry.amount_npr,
          description: entry.description,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networth-entries'] });
      toast.success('Entry saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkInsertEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<NetworthEntry>[]) => {
      if (!rows.length) return;
      const { error } = await supabase.from('networth_entries').insert(rows as never);
      if (error) throw error;
      await logNwActivity('NETWORTH_BULK_IMPORT', 'networth_entry', 'bulk', {
        count: rows.length,
        total_amount_npr: rows.reduce((s, r) => s + Number(r.amount_npr || 0), 0),
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['networth-entries'] });
      toast.success(`${vars.length} entries imported`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from('networth_entries').select('category_name,amount_npr,type,description')
        .eq('id', id).maybeSingle();
      const { error } = await supabase.from('networth_entries').delete().eq('id', id);
      if (error) throw error;
      await logNwActivity('NETWORTH_ENTRY_DELETE', 'networth_entry', id, {
        category_name: existing?.category_name,
        amount_npr: existing?.amount_npr,
        type: existing?.type,
        description: existing?.description,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networth-entries'] });
      toast.success('Entry deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Settings ----------
export function useNetworthSettings() {
  return useQuery({
    queryKey: ['networth-settings'],
    queryFn: async (): Promise<NetworthSettings | null> => {
      const { data, error } = await supabase
        .from('networth_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as NetworthSettings | null;
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<NetworthSettings> & { id: string }) => {
      const { error } = await supabase
        .from('networth_settings')
        .update({
          goal_start_npr: s.goal_start_npr,
          goal_target_npr: s.goal_target_npr,
          goal_label: s.goal_label,
        })
        .eq('id', s.id);
      if (error) throw error;
      await logNwActivity('NETWORTH_SETTINGS_UPDATE', 'networth_settings', s.id, {
        goal_label: s.goal_label,
        goal_start_npr: s.goal_start_npr,
        goal_target_npr: s.goal_target_npr,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networth-settings'] });
      toast.success('Settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
