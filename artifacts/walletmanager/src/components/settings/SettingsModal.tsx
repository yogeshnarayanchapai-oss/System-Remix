import { useState } from 'react';
import { Plus, Edit2, Trash2, Star, StarOff, Eye, EyeOff, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ActiveAccountForm } from './ActiveAccountForm';
import { 
  useActiveAccounts, 
  useCreateActiveAccount, 
  useUpdateActiveAccount, 
  useDeleteActiveAccount,
  useSetPrimaryAccount 
} from '@/hooks/useActiveAccounts';
import { ActiveAccount } from '@/lib/types';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ActiveAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const { data: accounts, isLoading } = useActiveAccounts();
  const createAccount = useCreateActiveAccount();
  const updateAccount = useUpdateActiveAccount();
  const deleteAccount = useDeleteActiveAccount();
  const setPrimaryAccount = useSetPrimaryAccount();

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleCreate = async (data: { email: string; password: string; totp_secret?: string; is_primary?: boolean }) => {
    await createAccount.mutateAsync(data);
    setShowForm(false);
  };

  const handleUpdate = async (data: { email: string; password: string; totp_secret?: string; is_primary?: boolean }) => {
    if (!editingAccount) return;
    await updateAccount.mutateAsync({ id: editingAccount.id, ...data });
    setEditingAccount(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteAccount.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleSetPrimary = async (id: string) => {
    await setPrimaryAccount.mutateAsync(id);
  };

  const maskPassword = (password: string) => '•'.repeat(Math.min(password.length, 12));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Active Accounts Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Manage account credentials for the public access page
              </p>
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Primary</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>2FA</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(5)].map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : accounts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No accounts added yet. Click "Add Account" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts?.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => !account.is_primary && handleSetPrimary(account.id)}
                            disabled={account.is_primary}
                            title={account.is_primary ? 'Primary Account' : 'Set as Primary'}
                          >
                            {account.is_primary ? (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            ) : (
                              <StarOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{account.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {visiblePasswords.has(account.id) 
                                ? account.password 
                                : maskPassword(account.password)}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => togglePasswordVisibility(account.id)}
                            >
                              {visiblePasswords.has(account.id) 
                                ? <EyeOff className="h-3 w-3" /> 
                                : <Eye className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {account.totp_secret ? (
                            <Badge variant="outline" className="text-success border-success">
                              Configured
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Not Set
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingAccount(account)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(account.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Form */}
      <ActiveAccountForm
        open={showForm || !!editingAccount}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingAccount(null);
          }
        }}
        account={editingAccount}
        onSubmit={editingAccount ? handleUpdate : handleCreate}
        isLoading={createAccount.isPending || updateAccount.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Account"
        description="Are you sure you want to delete this account? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
