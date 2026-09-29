import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export type PartyEntryType = 'INCOMING' | 'OUTGOING';

export interface PartyTransaction {
  id: string;
  party_id: string;
  entry_date: string;
  entry_type: PartyEntryType;
  amount_npr: number;
  remark: string | null;
  source_transaction_id: string | null;
  nepali_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export function usePartyTransactions(partyId?: string) {
  return useQuery({
    queryKey: ['party-transactions', partyId, 'all-pages'],
    queryFn: async () => {
      if (!partyId) return [];

      const pageSize = 1000;
      let offset = 0;
      const allTransactions: PartyTransaction[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('party_transactions')
          .select('*')
          .eq('party_id', partyId)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        const batch = (data || []) as PartyTransaction[];
        allTransactions.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      return allTransactions;
    },
    enabled: !!partyId,
  });
}

export function useCreatePartyTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      party_id: string;
      entry_date: string;
      entry_type: PartyEntryType;
      amount_npr: number;
      remark?: string;
      source_transaction_id?: string;
      nepali_account_id?: string | null;
    }) => {
      // First, create the party transaction
      const { data: result, error } = await supabase
        .from('party_transactions')
        .insert({
          party_id: data.party_id,
          entry_date: data.entry_date,
          entry_type: data.entry_type,
          amount_npr: data.amount_npr,
          remark: data.remark || null,
          source_transaction_id: data.source_transaction_id || null,
          nepali_account_id: data.nepali_account_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If nepali_account_id is provided, create ledger entry
      if (data.nepali_account_id) {
        // INCOMING (party pays us) = CREDIT to NPR account
        // OUTGOING (we pay party) = DEBIT from NPR account
        const ledgerEntryType = data.entry_type === 'INCOMING' ? 'CREDIT' : 'DEBIT';
        const sourceType = data.entry_type === 'INCOMING' ? 'PARTY_RECEIVE' : 'PARTY_PAY';

        const { error: ledgerError } = await supabase
          .from('nepali_account_ledger')
          .insert({
            nepali_account_id: data.nepali_account_id,
            entry_date: data.entry_date,
            entry_type: ledgerEntryType,
            amount_npr: data.amount_npr,
            source_type: sourceType,
            source_id: result.id,
            remark: data.remark || null,
          });

        if (ledgerError) throw ledgerError;
      }

      // Log activity (only for manual entries, not auto-created from transactions)
      if (user && !data.source_transaction_id) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'PARTY_TXN_CREATE',
          entity_type: 'party_transaction',
          entity_id: result.id,
          meta: { amount_npr: data.amount_npr, entry_type: data.entry_type },
        }]);
      }

      return result as PartyTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Entry saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateBulkPartyTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: Array<{
      party_id: string;
      entry_date: string;
      entry_type: PartyEntryType;
      amount_npr: number;
      remark?: string;
      source_transaction_id?: string;
    }>) => {
      const { data: result, error } = await supabase
        .from('party_transactions')
        .insert(entries.map(e => ({
          party_id: e.party_id,
          entry_date: e.entry_date,
          entry_type: e.entry_type,
          amount_npr: e.amount_npr,
          remark: e.remark || null,
          source_transaction_id: e.source_transaction_id || null,
        })))
        .select();

      if (error) throw error;
      return result as PartyTransaction[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useSettleAllParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      partyId, 
      settleType, 
      amountNpr,
      nepaliAccountId,
    }: { 
      partyId: string; 
      settleType: 'INCOMING' | 'OUTGOING';
      amountNpr: number;
      nepaliAccountId?: string | null;
    }) => {
      // Create a settle entry using the opposite type to zero out balance
      const { data: result, error } = await supabase
        .from('party_transactions')
        .insert({
          party_id: partyId,
          entry_date: new Date().toISOString().split('T')[0],
          entry_type: settleType,
          amount_npr: amountNpr,
          remark: 'settle all',
          nepali_account_id: nepaliAccountId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // If nepali_account_id is provided, create ledger entry
      if (nepaliAccountId) {
        // INCOMING (party pays us) = CREDIT to NPR account
        // OUTGOING (we pay party) = DEBIT from NPR account
        const ledgerEntryType = settleType === 'INCOMING' ? 'CREDIT' : 'DEBIT';
        const sourceType = settleType === 'INCOMING' ? 'PARTY_RECEIVE' : 'PARTY_PAY';

        const { error: ledgerError } = await supabase
          .from('nepali_account_ledger')
          .insert({
            nepali_account_id: nepaliAccountId,
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: ledgerEntryType,
            amount_npr: amountNpr,
            source_type: sourceType,
            source_id: result.id,
            remark: 'settle all',
          });

        if (ledgerError) throw ledgerError;
      }

      return result as PartyTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      toast.success('All settled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdatePartyTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string;
      data: {
        entry_date?: string;
        entry_type?: PartyEntryType;
        amount_npr?: number;
        remark?: string | null;
        nepali_account_id?: string | null;
      };
    }) => {
      const { data: result, error } = await supabase
        .from('party_transactions')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Sync nepali_account_ledger entries linked to this party_transaction.
      // Always wipe existing PARTY_RECEIVE/PARTY_PAY ledger rows tied to this
      // entry, then re-create one if the updated row has a nepali_account_id.
      const { error: delLedgerError } = await supabase
        .from('nepali_account_ledger')
        .delete()
        .eq('source_id', id)
        .in('source_type', ['PARTY_RECEIVE', 'PARTY_PAY']);

      if (delLedgerError) throw delLedgerError;

      if (result.nepali_account_id) {
        const ledgerEntryType = result.entry_type === 'INCOMING' ? 'CREDIT' : 'DEBIT';
        const sourceType = result.entry_type === 'INCOMING' ? 'PARTY_RECEIVE' : 'PARTY_PAY';

        const { error: insLedgerError } = await supabase
          .from('nepali_account_ledger')
          .insert({
            nepali_account_id: result.nepali_account_id,
            entry_date: result.entry_date,
            entry_type: ledgerEntryType,
            amount_npr: result.amount_npr,
            source_type: sourceType,
            source_id: result.id,
            remark: result.remark || null,
          });

        if (insLedgerError) throw insLedgerError;
      }

      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'PARTY_TXN_UPDATE',
          entity_type: 'party_transaction',
          entity_id: id,
          meta: { changes: data },
        }]);
      }

      return result as PartyTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['all-party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Entry updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeletePartyTransaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get the entry before deleting for logging
      const { data: entry } = await supabase
        .from('party_transactions')
        .select('amount_npr, entry_type, source_transaction_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('party_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log activity (only for manual entries)
      if (user && entry && !entry.source_transaction_id) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'PARTY_TXN_DELETE',
          entity_type: 'party_transaction',
          entity_id: id,
          meta: { amount_npr: entry.amount_npr, entry_type: entry.entry_type },
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['all-party-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Entry deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Calculate party ledger summary from party_transactions
// OUTGOING = लिनुपर्ने (Receivable) - money we gave out, we need to receive
// INCOMING = दिनुपर्ने (Payable) - money we received, we need to pay
export function usePartyLedgerSummary(partyId?: string) {
  return useQuery({
    queryKey: ['party-ledger-summary', partyId],
    queryFn: async () => {
      if (!partyId) return { receivable: 0, payable: 0, net: 0 };
      
      const { data, error } = await supabase
        .from('party_transactions')
        .select('entry_type, amount_npr')
        .eq('party_id', partyId);
      
      if (error) throw error;

      let totalOutgoing = 0; // OUTGOING = लिनुपर्ने (Receivable)
      let totalIncoming = 0; // INCOMING = दिनुपर्ने (Payable)

      (data || []).forEach(entry => {
        if (entry.entry_type === 'OUTGOING') {
          totalOutgoing += entry.amount_npr;
        } else if (entry.entry_type === 'INCOMING') {
          totalIncoming += entry.amount_npr;
        }
      });

      // Net = Outgoing - Incoming
      // Positive net = Receivable (लिनुपर्ने)
      // Negative net = Payable (दिनुपर्ने)
      const net = totalOutgoing - totalIncoming;

      return {
        receivable: net > 0 ? net : 0,
        payable: net < 0 ? Math.abs(net) : 0,
        net,
      };
    },
    enabled: !!partyId,
  });
}
