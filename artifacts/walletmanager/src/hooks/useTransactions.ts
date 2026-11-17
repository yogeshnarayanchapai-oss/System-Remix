import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Transaction, TxnType } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY } from './useAccountBalanceHistory';

interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  txnType?: TxnType;
  paypalAccountId?: string;
  partyId?: string;
  search?: string;
  isSettled?: boolean;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transactions', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          parties(*),
          paypal_accounts(*),
          paypal_emails(*)
        `)
        .order('txn_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      
      if (filters.dateFrom) {
        query = query.gte('txn_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('txn_date', filters.dateTo);
      }
      if (filters.txnType) {
        query = query.eq('txn_type', filters.txnType);
      }
      if (filters.paypalAccountId) {
        query = query.eq('paypal_account_id', filters.paypalAccountId);
      }
      if (filters.partyId) {
        query = query.eq('party_id', filters.partyId);
      }
      if (filters.isSettled !== undefined) {
        query = query.eq('is_settled', filters.isSettled);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let result = data as Transaction[];
      
      // Client-side search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(txn => 
          txn.parties?.party_name?.toLowerCase().includes(searchLower) ||
          txn.paypal_accounts?.paypal_name?.toLowerCase().includes(searchLower) ||
          txn.paypal_emails?.email?.toLowerCase().includes(searchLower) ||
          txn.remark?.toLowerCase().includes(searchLower) ||
          txn.reference_id?.toLowerCase().includes(searchLower) ||
          txn.amount?.toString().includes(filters.search!)
        );
      }
      
      return result;
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transactions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          parties(*),
          paypal_accounts(*),
          paypal_emails(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Transaction;
    },
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: {
      txn_date: string;
      txn_type: TxnType;
      party_id: string;
      paypal_account_id: string;
      paypal_email_id: string | null;
      amount: number;
      rate: number;
      total: number;
      remark?: string;
      reference_id?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('transactions')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'TRANSACTION_CREATE',
          entity_type: 'transaction',
          entity_id: result.id,
          meta: { amount: data.amount, rate: data.rate, total: data.total, txn_type: data.txn_type },
        }]);
      }

      return result as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Transaction saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateBulkTransactions() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transactions: Array<{
      txn_date: string;
      txn_type: TxnType;
      party_id: string;
      paypal_account_id: string;
      paypal_email_id: string | null;
      amount: number;
      rate: number;
      total: number;
      remark?: string;
    }>) => {
      const { data: result, error } = await supabase
        .from('transactions')
        .insert(transactions)
        .select();
      
      if (error) throw error;
      return result as Transaction[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${data.length} transactions saved`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      txn_date?: string;
      txn_type?: TxnType;
      party_id?: string;
      paypal_account_id?: string;
      paypal_email_id?: string | null;
      amount?: number;
      rate?: number;
      total?: number;
      remark?: string;
      reference_id?: string;
    }) => {
      // Fetch current transaction (for backward-compatible party ledger sync
      // when old party_transactions rows have NULL source_transaction_id)
      const { data: beforeTxn, error: beforeError } = await supabase
        .from('transactions')
        .select('party_id, txn_date, txn_type, total, amount, rate')
        .eq('id', id)
        .single();

      if (beforeError) throw beforeError;

      // Update the transaction
      const { data: result, error } = await supabase
        .from('transactions')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      const updatedTxn = result as Transaction;

      // Log activity with changes
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'TRANSACTION_UPDATE',
          entity_type: 'transaction',
          entity_id: id,
          changes: {
            before: { amount: beforeTxn.amount, rate: beforeTxn.rate, total: beforeTxn.total },
            after: { amount: updatedTxn.amount, rate: updatedTxn.rate, total: updatedTxn.total },
          },
        }]);
      }
      
      // Also update the linked party_transaction entry
      const entryType = updatedTxn.txn_type === 'INCOMING' ? 'INCOMING' : 'OUTGOING';
      const amountNpr = updatedTxn.amount * updatedTxn.rate;
      
      // Build remark: (amount*rate) format
      const autoRemark = `(${updatedTxn.amount}*${updatedTxn.rate})`;
      const finalRemark = updatedTxn.remark 
        ? `${updatedTxn.remark}, ${autoRemark}`
        : autoRemark;
      
      // 1) Preferred path: update by source_transaction_id
      const { data: updatedPartyRows, error: partyError } = await supabase
        .from('party_transactions')
        .update({
          party_id: updatedTxn.party_id,
          entry_date: updatedTxn.txn_date,
          entry_type: entryType,
          amount_npr: amountNpr,
          remark: finalRemark,
        })
        .eq('source_transaction_id', id)
        .select('id');
      
      if (partyError) console.error('Failed to update party transaction:', partyError);

      // 2) Backward-compatible path: old rows might have NULL source_transaction_id
      // Try to find/update the matching old row by the PRE-update transaction values.
      if (!partyError && (!updatedPartyRows || updatedPartyRows.length === 0)) {
        const oldEntryType = beforeTxn.txn_type === 'INCOMING' ? 'INCOMING' : 'OUTGOING';

        const { error: fallbackError } = await supabase
          .from('party_transactions')
          .update({
            party_id: updatedTxn.party_id,
            entry_date: updatedTxn.txn_date,
            entry_type: entryType,
            amount_npr: amountNpr,
            remark: finalRemark,
            source_transaction_id: id,
          })
          .is('source_transaction_id', null)
          .eq('party_id', beforeTxn.party_id)
          .eq('entry_date', beforeTxn.txn_date)
          .eq('entry_type', oldEntryType)
          .eq('amount_npr', beforeTxn.total);

        if (fallbackError) {
          console.error('Failed to fallback-update party transaction:', fallbackError);
        }
      }
      
      return updatedTxn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['party-ledger-summary'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Transaction updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useSettleTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, settle, note }: { id: string; settle: boolean; note?: string }) => {
      const updateData = settle 
        ? { is_settled: true, settled_at: new Date().toISOString(), settlement_note: note || null }
        : { is_settled: false, settled_at: null, settlement_note: null };
      
      const { data: result, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Transaction;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(variables.settle ? 'Transaction settled' : 'Transaction unsettled');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch txn before deleting (needed for backward-compatible ledger delete)
      const { data: txn, error: txnErr } = await supabase
        .from('transactions')
        .select('party_id, txn_date, txn_type, total, amount, rate')
        .eq('id', id)
        .single();

      if (txnErr) throw txnErr;

      // First delete the linked party_transaction entry
      const { error: partyError } = await supabase
        .from('party_transactions')
        .delete()
        .eq('source_transaction_id', id);
      
      if (partyError) {
        console.error('Failed to delete party transaction:', partyError);
      }

      // Backward-compatible: delete any old matching row that has NULL source_transaction_id
      const oldEntryType = txn.txn_type === 'INCOMING' ? 'INCOMING' : 'OUTGOING';
      const { error: partyFallbackError } = await supabase
        .from('party_transactions')
        .delete()
        .is('source_transaction_id', null)
        .eq('party_id', txn.party_id)
        .eq('entry_date', txn.txn_date)
        .eq('entry_type', oldEntryType)
        .eq('amount_npr', txn.total);

      if (partyFallbackError) {
        console.error('Failed to fallback-delete party transaction:', partyFallbackError);
      }
      
      // Then delete the transaction
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'TRANSACTION_DELETE',
          entity_type: 'transaction',
          entity_id: id,
          meta: { amount: txn.amount, rate: txn.rate, total: txn.total, txn_type: txn.txn_type },
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['party-ledger-summary'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Transaction deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
