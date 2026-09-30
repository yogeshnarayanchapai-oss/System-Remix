import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaypalAccount } from '@/lib/types';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY } from './useAccountBalanceHistory';

export function usePaypalAccounts() {
  return useQuery({
    queryKey: ['paypal-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paypal_accounts')
        .select('*')
        .order('paypal_name');
      
      if (error) throw error;
      return data as PaypalAccount[];
    },
  });
}

export function useActivePaypalAccounts() {
  return useQuery({
    queryKey: ['paypal-accounts', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paypal_accounts')
        .select('*')
        .eq('is_active', true)
        .order('paypal_name');
      
      if (error) throw error;
      return data as PaypalAccount[];
    },
  });
}

export function usePaypalAccount(id: string) {
  return useQuery({
    queryKey: ['paypal-accounts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paypal_accounts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as PaypalAccount;
    },
    enabled: !!id,
  });
}

export function useCreatePaypalAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: { 
      paypal_name: string; 
      note?: string; 
      tag?: string | null;
      is_active?: boolean;
      opening_balance_amount?: number;
      opening_balance_rate?: number;
      opening_balance_total?: number;
    }) => {
      const { data: result, error } = await supabase
        .from('paypal_accounts')
        .insert(data as any)
        .select()
        .single();
      
      if (error) throw error;

      // Log activity
      if (user) {
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: 'USD_ACCOUNT_CREATE',
          entity_type: 'usd_account',
          entity_id: result.id,
          meta: { 
            name: data.paypal_name, 
            opening_balance_amount: data.opening_balance_amount,
            opening_balance_rate: data.opening_balance_rate,
          },
        }]);
      }

      return result as PaypalAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypal-accounts'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Wallet account created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdatePaypalAccount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { 
      id: string; 
      paypal_name?: string; 
      note?: string; 
      tag?: string | null;
      is_active?: boolean;
      opening_balance_amount?: number;
      opening_balance_rate?: number;
      opening_balance_total?: number;
    }) => {
      // Get current values for change tracking
      const { data: before } = await supabase
        .from('paypal_accounts')
        .select('paypal_name, opening_balance_amount, opening_balance_rate, opening_balance_total')
        .eq('id', id)
        .single();

      const { data: result, error } = await supabase
        .from('paypal_accounts')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Log activity
      if (user) {
        const isOpeningBalanceChange = (data.opening_balance_amount !== undefined && 
          before?.opening_balance_amount !== data.opening_balance_amount) ||
          (data.opening_balance_rate !== undefined && 
          before?.opening_balance_rate !== data.opening_balance_rate);
        
        await supabase.from('user_activity_logs').insert([{
          user_id: user.id,
          user_email: user.email || 'unknown',
          action: isOpeningBalanceChange ? 'USD_OPENING_BALANCE_UPDATE' : 'USD_ACCOUNT_UPDATE',
          entity_type: 'usd_account',
          entity_id: id,
          changes: { before, after: result },
          meta: { name: result.paypal_name },
        }]);
      }

      return result as PaypalAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypal-accounts'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['user-activity-logs'] });
      toast.success('Wallet account updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeletePaypalAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('paypal_accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypal-accounts'] });
      queryClient.invalidateQueries({ queryKey: USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Wallet account deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
