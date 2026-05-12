import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'ADMIN' | 'EDITOR';

interface UserRole {
  role: AppRole;
  isAdmin: boolean;
  isEditor: boolean;
}

export function useUserRole() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async (): Promise<UserRole | null> => {
      if (!user?.id) return null;

      // Use the get_user_role function
      const { data, error } = await supabase
        .rpc('get_user_role', { _user_id: user.id });

      if (error) {
        console.error('Error fetching user role:', error);
        // Default to EDITOR if role fetch fails for security
        return { role: 'EDITOR', isAdmin: false, isEditor: true };
      }

      const role = (data as AppRole) || 'EDITOR';
      return {
        role,
        isAdmin: role === 'ADMIN',
        isEditor: role === 'EDITOR',
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    role: data?.role || null,
    isAdmin: data?.isAdmin || false,
    isEditor: data?.isEditor || false,
    isLoading,
  };
}
