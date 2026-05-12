import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PaypalEmail, EmailStatus } from '@/lib/types';
import { toast } from 'sonner';

export function usePaypalEmails(paypalAccountId?: string) {
  return useQuery({
    queryKey: ['paypal-emails', paypalAccountId],
    queryFn: async () => {
      let query = supabase
        .from('paypal_emails')
        .select('*, paypal_accounts(*)');
      
      if (paypalAccountId) {
        query = query.eq('paypal_account_id', paypalAccountId);
      }
      
      const { data, error } = await query.order('email');
      
      if (error) throw error;
      return data as PaypalEmail[];
    },
    enabled: paypalAccountId ? !!paypalAccountId : true,
  });
}

export function useActivePaypalEmails(paypalAccountId: string) {
  return useQuery({
    queryKey: ['paypal-emails', paypalAccountId, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paypal_emails')
        .select('*')
        .eq('paypal_account_id', paypalAccountId)
        .eq('status', 'ACTIVE')
        .order('is_primary', { ascending: false })
        .order('email');
      
      if (error) throw error;
      return data as PaypalEmail[];
    },
    enabled: !!paypalAccountId,
  });
}

export function useCreatePaypalEmail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      paypal_account_id: string; 
      email: string; 
      status?: EmailStatus; 
      is_primary?: boolean 
    }) => {
      const { data: result, error } = await supabase
        .from('paypal_emails')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result as PaypalEmail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypal-emails'] });
      toast.success('Email added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdatePaypalEmail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { 
      id: string; 
      email?: string; 
      status?: EmailStatus; 
      is_primary?: boolean 
    }) => {
      const { data: result, error } = await supabase
        .from('paypal_emails')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as PaypalEmail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypal-emails'] });
      toast.success('Email updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeletePaypalEmail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('paypal_emails')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paypal-emails'] });
      toast.success('Email deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
