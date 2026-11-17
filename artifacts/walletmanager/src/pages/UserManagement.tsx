import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Shield, Edit3, Plus, Key, UserX, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { usePaypalAccounts } from '@/hooks/usePaypalAccounts';
import { useNepaliAccounts } from '@/hooks/useNepaliAccounts';

type AppRole = 'ADMIN' | 'EDITOR';

interface UserWithRole {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
  is_active: boolean;
  paypalAccountIds: string[];
  nepaliAccountIds: string[];
}

interface UserManagementProps { embedded?: boolean }
export default function UserManagement({ embedded = false }: UserManagementProps = {}) {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('EDITOR');
  const [selectedPaypalIds, setSelectedPaypalIds] = useState<string[]>([]);
  const [selectedNepaliIds, setSelectedNepaliIds] = useState<string[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState<string | null>(null);
  
  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('EDITOR');
  
  // Change password form state
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const { data: paypalAccounts } = usePaypalAccounts();
  const { data: nepaliAccounts } = useNepaliAccounts(false);

  // Fetch all users with their roles from edge function
  const { data: userManagementData, isLoading, isError, error } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async (): Promise<{ users: UserWithRole[]; walletAccessReady: boolean; walletAccessError: string | null }> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Get auth users from edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'get_users' }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch users');
      }

      const { users: authUsers } = await response.json();

      // Get user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;
      const { data: accessRows, error: accessError } = await (supabase as any)
        .from('user_account_access')
        .select('user_id, paypal_account_id, nepali_account_id');

      // Combine the data
      const usersWithRoles: UserWithRole[] = authUsers.map((user: any) => {
        const roleEntry = roles?.find(r => r.user_id === user.id);
        const userAccess = (accessRows || []).filter((row: any) => row.user_id === user.id);
        return {
          user_id: user.id,
          email: user.email,
          role: (roleEntry?.role || 'EDITOR') as AppRole,
          created_at: user.created_at,
          is_active: !user.banned_until || new Date(user.banned_until) < new Date(),
          paypalAccountIds: userAccess.flatMap((row: any) => row.paypal_account_id ? [row.paypal_account_id] : []),
          nepaliAccountIds: userAccess.flatMap((row: any) => row.nepali_account_id ? [row.nepali_account_id] : []),
        };
      });

      return {
        users: usersWithRoles,
        walletAccessReady: !accessError,
        walletAccessError: accessError?.message || null,
      };
    },
  });
  const users = userManagementData?.users;
  const walletAccessReady = userManagementData?.walletAccessReady ?? false;

  const updateAccountAccessMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) throw new Error('Select a user first');
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: editRole })
        .eq('user_id', editingUser.user_id);
      if (roleError) throw roleError;

      if (walletAccessReady) {
        const { error } = await (supabase as any).rpc('walletmanager_replace_user_account_access', {
        _target_user_id: editingUser.user_id,
        _paypal_account_ids: selectedPaypalIds,
        _nepali_account_ids: selectedNepaliIds,
      });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      queryClient.invalidateQueries({ queryKey: ['paypal-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['paypal-accounts-with-balances'] });
      queryClient.invalidateQueries({ queryKey: ['nepali-accounts-with-balances'] });
      toast.success('User changes saved');
      setEditingUser(null);
    },
    onError: (error: Error) => toast.error(`Could not save user changes: ${error.message}`),
  });

  const openEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setEditRole(user.role);
    setSelectedPaypalIds(user.paypalAccountIds);
    setSelectedNepaliIds(user.nepaliAccountIds);
  };

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, role }: { email: string; password: string; role: AppRole }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'create_user', email, password, role }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('User created successfully');
      setShowAddUser(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('EDITOR');
    },
    onError: (error) => {
      toast.error('Failed to create user: ' + error.message);
    },
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'update_password', user_id: userId, password }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Password updated successfully');
      setShowChangePassword(null);
      setChangePasswordValue('');
    },
    onError: (error) => {
      toast.error('Failed to update password: ' + error.message);
    },
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'toggle_user_status', user_id: userId, is_active: isActive }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('User status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    createUserMutation.mutate({ email: newEmail, password: newPassword, role: newRole });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (changePasswordValue.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (showChangePassword) {
      updatePasswordMutation.mutate({ userId: showChangePassword, password: changePasswordValue });
    }
  };

  const adminCount = users?.filter(u => u.role === 'ADMIN').length || 0;
  const editorCount = users?.filter(u => u.role === 'EDITOR').length || 0;

  const inner = (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="User Management"
          description="Manage user roles and permissions"
        />
      )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{adminCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Editors</CardTitle>
              <Edit3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{editorCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>All Users</CardTitle>
            <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-role">Role</Label>
                    <Select value={newRole} onValueChange={(v: AppRole) => setNewRole(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="EDITOR">EDITOR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isError ? (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                User list could not be loaded.
                <div className="mt-1 text-xs">{error instanceof Error ? error.message : String((error as any)?.message || error)}</div>
              </div>
            ) : (
              <>
            {!walletAccessReady && !isLoading && (
              <div role="status" className="mb-4 rounded-md border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                User list is available, but wallet assignments are disabled until the account-access SQL migration is applied in Supabase.
                {userManagementData?.walletAccessError && <div className="mt-1 text-xs opacity-80">{userManagementData.walletAccessError}</div>}
              </div>
            )}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Wallet Access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map(user => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.role === 'ADMIN' ? (
                          <Badge>All wallets</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {walletAccessReady ? `${user.paypalAccountIds.length + user.nepaliAccountIds.length} assigned` : 'Unavailable'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={(checked) => 
                              toggleStatusMutation.mutate({ userId: user.user_id, isActive: checked })
                            }
                          />
                          {user.is_active ? (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          ) : (
                            <UserX className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditUser(user)}>Edit</Button>
                        <Dialog 
                          open={showChangePassword === user.user_id} 
                          onOpenChange={(open) => {
                            setShowChangePassword(open ? user.user_id : null);
                            if (!open) setChangePasswordValue('');
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Key className="h-4 w-4 mr-1" />
                              Password
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Change Password for {user.email}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="change-password">New Password</Label>
                                <Input
                                  id="change-password"
                                  type="password"
                                  value={changePasswordValue}
                                  onChange={(e) => setChangePasswordValue(e.target.value)}
                                  placeholder="••••••••"
                                  required
                                  minLength={6}
                                />
                              </div>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button type="button" variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={updatePasswordMutation.isPending}>
                                  {updatePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!users || users.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
              </>
            )}
          </CardContent>
        </Card>
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit user — {editingUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(value: AppRole) => setEditRole(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="EDITOR">EDITOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!walletAccessReady && (
                <div role="status" className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  Role can be saved now. Wallet choices will be editable after the account-access migration is applied in Supabase.
                </div>
              )}
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <section className="space-y-3">
                <h3 className="font-medium">USD wallets</h3>
                {!paypalAccounts?.length && <p className="text-sm text-muted-foreground">No active USD wallets.</p>}
                {paypalAccounts?.map((account) => (
                  <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={selectedPaypalIds.includes(account.id)}
                      disabled={!walletAccessReady || editRole === 'ADMIN'}
                      onCheckedChange={(checked) => setSelectedPaypalIds((ids) =>
                        checked ? [...new Set([...ids, account.id])] : ids.filter((id) => id !== account.id)
                      )}
                    />
                    <span>{account.paypal_name}</span>
                  </label>
                ))}
              </section>
              <section className="space-y-3">
                <h3 className="font-medium">NPR wallets</h3>
                {!nepaliAccounts?.length && <p className="text-sm text-muted-foreground">No active NPR wallets.</p>}
                {nepaliAccounts?.map((account) => (
                  <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
                    <Checkbox
                      checked={selectedNepaliIds.includes(account.id)}
                      disabled={!walletAccessReady || editRole === 'ADMIN'}
                      onCheckedChange={(checked) => setSelectedNepaliIds((ids) =>
                        checked ? [...new Set([...ids, account.id])] : ids.filter((id) => id !== account.id)
                      )}
                    />
                    <span>{account.name}</span>
                  </label>
                ))}
              </section>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={() => updateAccountAccessMutation.mutate()} disabled={updateAccountAccessMutation.isPending}>
                {updateAccountAccessMutation.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );

  return embedded ? inner : <AppLayout>{inner}</AppLayout>;
}
