import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Party } from '@/lib/types';
import { toast } from 'sonner';

export function useParties() {
  return useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .order('party_name');
      
      if (error) throw error;
      return data as Party[];
    },
  });
}

export function useParty(id: string) {
  return useQuery({
    queryKey: ['parties', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Party;
    },
    enabled: !!id,
  });
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { party_name: string; phone?: string; note?: string; default_rate?: number; secret_code?: string; email?: string }) => {
      const { data: result, error } = await supabase
        .from('parties')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result as Party;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Party created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateParty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; party_name?: string; phone?: string; note?: string; default_rate?: number | null; secret_code?: string | null; email?: string | null }) => {
      const { data: result, error } = await supabase
        .from('parties')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result as Party;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Party updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteParty() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast.success('Party deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
