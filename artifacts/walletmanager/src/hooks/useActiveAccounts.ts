import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ActiveAccount } from '@/lib/types';
import { toast } from 'sonner';

export function useActiveAccounts() {
  return useQuery({
    queryKey: ['active-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_accounts')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ActiveAccount[];
    },
  });
}

export function usePrimaryAccount() {
  return useQuery({
    queryKey: ['active-accounts', 'primary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_accounts')
        .select('*')
        .eq('is_primary', true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as ActiveAccount | null;
    },
  });
}

export function useCreateActiveAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      email: string; 
      password: string; 
      totp_secret?: string; 
      is_primary?: boolean 
    }) => {
      // If setting as primary, first unset any existing primary
      if (data.is_primary) {
        await supabase
          .from('active_accounts')
          .update({ is_primary: false })
          .eq('is_primary', true);
      }
      
      const { data: result, error } = await supabase
        .from('active_accounts')
        .insert({
          email: data.email,
          password: data.password,
          totp_secret: data.totp_secret || null,
          is_primary: data.is_primary || false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result as ActiveAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-accounts'] });
      toast.success('Account added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateActiveAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      ...data 
    }: { 
      id: string; 
      email?: string; 
      password?: string; 
      totp_secret?: string | null; 
      is_primary?: boolean 
    }) => {
      // If setting as primary, first unset any existing primary
      if (data.is_primary) {
        await supabase
          .from('active_accounts')
          .update({ is_primary: false })
          .neq('id', id)
          .eq('is_primary', true);
      }
      
      const { data: result, error } = await supabase
        .from('active_accounts')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as ActiveAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-accounts'] });
      toast.success('Account updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteActiveAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('active_accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-accounts'] });
      toast.success('Account deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useSetPrimaryAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First unset all primary
      await supabase
        .from('active_accounts')
        .update({ is_primary: false })
        .eq('is_primary', true);
      
      // Set the new primary
      const { data: result, error } = await supabase
        .from('active_accounts')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as ActiveAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-accounts'] });
      toast.success('Primary account updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
