import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export type NepaliAccountStatus = 'ACTIVE' | 'INACTIVE';

export interface NepaliAccount {
  id: string;
  name: string;
  opening_balance_npr: number;
  status: NepaliAccountStatus;
  created_at: string;
  updated_at: string;
}

export interface NepaliAccountWithBalance extends NepaliAccount {
  available_balance_npr: number;
}

export type NepaliLedgerEntryType = 'CREDIT' | 'DEBIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type NepaliLedgerSourceType = 'PARTY_RECEIVE' | 'PARTY_PAY' | 'TRANSFER';

export interface NepaliAccountLedgerEntry {
  id: string;
  nepali_account_id: string;
  entry_date: string;
  entry_type: NepaliLedgerEntryType;
  amount_npr: number;
  source_type: NepaliLedgerSourceType;
  source_id: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all Nepali accounts
export function useNepaliAccounts(activeOnly = false) {
  return useQuery({
    queryKey: ['nepali-accounts', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('nepali_accounts')
        .select('*')
        .order('name');
      
      if (activeOnly) {
        query = query.eq('status', 'ACTIVE');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as NepaliAccount[];
    },
  });
}

// Fetch Nepali accounts with calculated balances
export function useNepaliAccountsWithBalances() {
  return useQuery({
    queryKey: ['nepali-accounts-with-balances'],
    queryFn: async () => {
      // Read from aggregated DB view (future-proof, avoids client-side double counting)
      const { data, error } = await supabase
        .from('nepali_accounts_with_balance')
        .select('*')
        .order('name');

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        opening_balance_npr: Number(row.opening_balance_npr) || 0,
        available_balance_npr: Number(row.available_balance_npr) || 0,
      })) as NepaliAccountWithBalance[];
    },
  });
}

// Get total NPR balance for active accounts
export function useTotalNprBalance() {
  const { data: accounts, isLoading, error } = useNepaliAccountsWithBalances();
  
  const totalBalance = accounts
    ?.filter(acc => acc.status === 'ACTIVE')
    .reduce((sum, acc) => sum + acc.available_balance_npr, 0) || 0;

  return { totalBalance, isLoading, error };
}

// Create Nepali account
export function useCreateNepaliAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; opening_balance_npr: number; status: NepaliAccountStatus }) => {
      const { data: result, error } = await supabase
        .from('nepali_accounts')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'NEPALI_ACCOUNT_CREATE',
          entity_type: 'nepali_account',
          entity_id: result.id,
          meta: { name: data.name, opening_balance_npr: data.opening_balance_npr },
        }]);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Nepali Account created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create Nepali Account', { description: error.message });
    },
  });
}

// Update Nepali account
export function useUpdateNepaliAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; opening_balance_npr?: number; status?: NepaliAccountStatus }) => {
      // Get current values for change tracking
      const { data: before } = await supabase
        .from('nepali_accounts')
        .select('name, opening_balance_npr, status')
        .eq('id', id)
        .single();

      const { data: result, error } = await supabase
        .from('nepali_accounts')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Log activity
      if (user) {
        const isOpeningBalanceChange = data.opening_balance_npr !== undefined && 
          before?.opening_balance_npr !== data.opening_balance_npr;
        
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: isOpeningBalanceChange ? 'NPR_OPENING_BALANCE_UPDATE' : 'NEPALI_ACCOUNT_UPDATE',
          entity_type: 'nepali_account',
          entity_id: id,
          changes: { before, after: result },
          meta: { name: result.name },
        }]);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Nepali Account updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update Nepali Account', { description: error.message });
    },
  });
}

// Delete Nepali account
export function useDeleteNepaliAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get account info for logging
      const { data: account } = await supabase
        .from('nepali_accounts')
        .select('name')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('nepali_accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'NEPALI_ACCOUNT_DELETE',
          entity_type: 'nepali_account',
          entity_id: id,
          meta: { name: account?.name },
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Nepali Account deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete Nepali Account', { description: error.message });
    },
  });
}

export function useCreateNepaliLedgerEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      nepali_account_id: string;
      entry_date: string;
      entry_type: NepaliLedgerEntryType;
      amount_npr: number;
      source_type: NepaliLedgerSourceType;
      source_id?: string | null;
      remark?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('nepali_account_ledger')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
    },
    onError: (error) => {
      toast.error('Failed to create ledger entry', { description: error.message });
    },
  });
}

// Create NPR transfer between accounts
export function useCreateNprTransfer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      from_account_id: string | null;
      to_account_id: string | null;
      from_account_name?: string;
      to_account_name?: string;
      amount_npr: number;
      transfer_date: string;
      remark?: string;
    }) => {
      const sourceId = crypto.randomUUID();
      const remark = data.remark?.trim() || null;

      const entries: any[] = [];

      // Only create TRANSFER_OUT if from_account_id is set
      if (data.from_account_id) {
        entries.push({
          nepali_account_id: data.from_account_id,
          entry_date: data.transfer_date,
          entry_type: 'TRANSFER_OUT',
          amount_npr: data.amount_npr,
          source_type: 'TRANSFER',
          source_id: sourceId,
          remark,
        });
      }

      // Only create TRANSFER_IN if to_account_id is set
      if (data.to_account_id) {
        entries.push({
          nepali_account_id: data.to_account_id,
          entry_date: data.transfer_date,
          entry_type: 'TRANSFER_IN',
          amount_npr: data.amount_npr,
          source_type: 'TRANSFER',
          source_id: sourceId,
          remark,
        });
      }

      if (entries.length === 0) throw new Error('At least one account must be selected');

      // Atomic insert
      const { error } = await supabase
        .from('nepali_account_ledger')
        .insert(entries);

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'NPR_TRANSFER_CREATE',
          entity_type: 'npr_transfer',
          entity_id: sourceId,
          meta: { 
            amount_npr: data.amount_npr,
            from_account: data.from_account_name || data.from_account_id,
            to_account: data.to_account_name || data.to_account_id,
            remark,
          },
        }]);
      }

      return { success: true, sourceId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['npr-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('NPR Transfer completed successfully');
    },
    onError: (error) => {
      toast.error('Failed to complete transfer', { description: error.message });
    },
  });
}

// Update NPR transfer by source_id (delete old entries + create new ones)
export function useUpdateNprTransfer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      sourceId: string;
      from_account_id: string | null;
      to_account_id: string | null;
      amount_npr: number;
      transfer_date: string;
      remark?: string;
    }) => {
      // Delete old entries
      const { error: deleteError } = await supabase
        .from('nepali_account_ledger')
        .delete()
        .eq('source_id', data.sourceId)
        .eq('source_type', 'TRANSFER');

      if (deleteError) throw deleteError;

      // Create new entries with same source_id
      const remark = data.remark?.trim() || null;
      const entries: any[] = [];

      if (data.from_account_id) {
        entries.push({
          nepali_account_id: data.from_account_id,
          entry_date: data.transfer_date,
          entry_type: 'TRANSFER_OUT',
          amount_npr: data.amount_npr,
          source_type: 'TRANSFER',
          source_id: data.sourceId,
          remark,
        });
      }

      if (data.to_account_id) {
        entries.push({
          nepali_account_id: data.to_account_id,
          entry_date: data.transfer_date,
          entry_type: 'TRANSFER_IN',
          amount_npr: data.amount_npr,
          source_type: 'TRANSFER',
          source_id: data.sourceId,
          remark,
        });
      }

      if (entries.length === 0) throw new Error('At least one account must be selected');

      const { error: insertError } = await supabase
        .from('nepali_account_ledger')
        .insert(entries);

      if (insertError) throw insertError;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'NPR_TRANSFER_UPDATE',
          entity_type: 'npr_transfer',
          entity_id: data.sourceId,
          meta: {
            amount_npr: data.amount_npr,
            from_account: data.from_account_id,
            to_account: data.to_account_id,
            remark,
          },
        }]);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['npr-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('NPR Transfer updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update transfer', { description: error.message });
    },
  });
}

// Delete NPR transfer by source_id
export function useDeleteNprTransfer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ sourceId, meta }: { sourceId: string; meta?: { amount_npr?: number; from_account?: string; to_account?: string } }) => {
      const { error } = await supabase
        .from('nepali_account_ledger')
        .delete()
        .eq('source_id', sourceId)
        .eq('source_type', 'TRANSFER');

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'NPR_TRANSFER_DELETE',
          entity_type: 'npr_transfer',
          entity_id: sourceId,
          meta: meta || null,
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['npr-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('NPR Transfer deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete transfer', { description: error.message });
    },
  });
}
