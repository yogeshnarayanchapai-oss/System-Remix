import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY } from './useAccountBalanceHistory';

export interface WalletTransfer {
  id: string;
  transfer_date: string;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number;
  rate: number;
  total: number;
  fee: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
  from_wallet?: { id: string; paypal_name: string };
  to_wallet?: { id: string; paypal_name: string };
}

interface TransferFilters {
  dateFrom?: string;
  dateTo?: string;
  walletId?: string;
}

export function useWalletTransfers(filters: TransferFilters = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wallet-transfers', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('wallet_transfers')
        .select(`
          *,
          from_wallet:paypal_accounts!wallet_transfers_from_wallet_id_fkey(id, paypal_name),
          to_wallet:paypal_accounts!wallet_transfers_to_wallet_id_fkey(id, paypal_name)
        `)
        .order('transfer_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (filters.dateFrom) {
        query = query.gte('transfer_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('transfer_date', filters.dateTo);
      }
      if (filters.walletId) {
        query = query.or(`from_wallet_id.eq.${filters.walletId},to_wallet_id.eq.${filters.walletId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Map rate/total fields to fee for backward compatibility
      return (data || []).map(t => ({
        ...t,
        fee: t.rate === 1 ? 0 : (t.total - t.amount), // Calculate fee from stored data
      })) as WalletTransfer[];
    },
  });
}

export function useCreateWalletTransfer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      transfer_date: string;
      from_wallet_id: string | null;
      to_wallet_id: string | null;
      from_wallet_name?: string;
      to_wallet_name?: string;
      amount: number;
      fee: number;
      remark?: string;
    }) => {
      // Store fee in rate/total fields for DB compatibility
      // rate = 1 (no conversion), total = amount (for backward compat with dashboard)
      // We'll track fee separately in calculation logic
      const insertData: any = {
          transfer_date: data.transfer_date,
          amount: data.amount,
          rate: 1,
          total: data.amount + data.fee,
          remark: data.remark ? `${data.remark}${data.fee > 0 ? ` (Fee: $${data.fee.toFixed(2)})` : ''}` : (data.fee > 0 ? `Fee: $${data.fee.toFixed(2)}` : undefined),
        };
      if (data.from_wallet_id) insertData.from_wallet_id = data.from_wallet_id;
      if (data.to_wallet_id) insertData.to_wallet_id = data.to_wallet_id;

      const { data: result, error } = await supabase
        .from('wallet_transfers')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'USD_TRANSFER_CREATE',
          entity_type: 'usd_transfer',
          entity_id: result.id,
          meta: { 
            amount: data.amount,
            fee: data.fee,
            from_wallet: data.from_wallet_name || data.from_wallet_id,
            to_wallet: data.to_wallet_name || data.to_wallet_id,
          },
        }]);
      }

      return { ...result, fee: data.fee } as WalletTransfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-transfers'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Transfer created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteWalletTransfer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, meta }: { id: string; meta?: { amount?: number; from_wallet?: string; to_wallet?: string } }) => {
      const { error } = await supabase
        .from('wallet_transfers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'USD_TRANSFER_DELETE',
          entity_type: 'usd_transfer',
          entity_id: id,
          meta: meta || null,
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-transfers'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Transfer deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
