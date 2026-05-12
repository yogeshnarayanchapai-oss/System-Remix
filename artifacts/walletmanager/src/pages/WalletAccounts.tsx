import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, 
  Wallet, 
  Mail, 
  Edit2, 
  Trash2, 
  Power,
  Star,
  Check,
  X,
  AlertTriangle,
  Search,
  Banknote,
  MoreHorizontal
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  usePaypalAccounts, 
  useCreatePaypalAccount, 
  useUpdatePaypalAccount, 
  useDeletePaypalAccount 
} from '@/hooks/usePaypalAccounts';
import {
  usePaypalEmails,
  useCreatePaypalEmail,
  useUpdatePaypalEmail,
  useDeletePaypalEmail
} from '@/hooks/usePaypalEmails';
import { usePaypalSummary } from '@/hooks/useDashboard';
import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatUSD } from '@/lib/format';
import { PaypalAccount, PaypalEmail, EmailStatus } from '@/lib/types';
import { NepaliAccountsTab } from '@/components/nepali-accounts/NepaliAccountsTab';

export default function WalletAccounts() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  
  // Account form state
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PaypalAccount | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({ 
    paypal_name: '', 
    note: '',
    opening_balance_amount: '',
    tag: '',
  });
  const [showOpeningBalanceWarning, setShowOpeningBalanceWarning] = useState(false);
  const [pendingOpeningBalanceChange, setPendingOpeningBalanceChange] = useState<any>(null);

  // Email management
  const [manageEmailsFor, setManageEmailsFor] = useState<PaypalAccount | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [deleteEmailId, setDeleteEmailId] = useState<string | null>(null);

  // Data hooks
  const { data: accounts, isLoading } = usePaypalAccounts();
  const { data: summaryData } = usePaypalSummary();
  const { data: viewBalances } = useQuery({
    queryKey: ['paypal-accounts-view-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paypal_accounts_with_balance')
        .select('id, balance');
      if (error) throw error;
      return data as { id: string; balance: number | null }[];
    },
  });
  const { isVisible: showSensitive, MASK } = useSensitiveDataVisibility();
  const { data: emails, isLoading: emailsLoading } = usePaypalEmails(manageEmailsFor?.id);
  const { data: allEmails } = usePaypalEmails(); // For search functionality
  
  const createAccount = useCreatePaypalAccount();
  const updateAccount = useUpdatePaypalAccount();
  const deleteAccount = useDeletePaypalAccount();
  const createEmail = useCreatePaypalEmail();
  const updateEmail = useUpdatePaypalEmail();
  const deleteEmail = useDeletePaypalEmail();

  const handleCreateAccount = async () => {
    if (!accountForm.paypal_name.trim()) return;
    
    const amount = parseFloat(accountForm.opening_balance_amount) || 0;
    
    await createAccount.mutateAsync({
      paypal_name: accountForm.paypal_name.trim(),
      note: accountForm.note.trim() || undefined,
      tag: accountForm.tag.trim() || null,
      opening_balance_amount: amount,
      opening_balance_rate: 1,
      opening_balance_total: amount,
    });
    
    setAccountForm({ paypal_name: '', note: '', opening_balance_amount: '', tag: '' });
    setShowCreateAccount(false);
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount || !accountForm.paypal_name.trim()) return;
    
    const amount = parseFloat(accountForm.opening_balance_amount) || 0;
    
    // Check if opening balance changed
    const originalAmount = editingAccount.opening_balance_amount || 0;
    
    if (amount !== originalAmount) {
      // Show warning dialog
      setPendingOpeningBalanceChange({
        id: editingAccount.id,
        paypal_name: accountForm.paypal_name.trim(),
        note: accountForm.note.trim() || undefined,
        tag: accountForm.tag.trim() || null,
        opening_balance_amount: amount,
        opening_balance_rate: 1,
        opening_balance_total: amount,
      });
      setShowOpeningBalanceWarning(true);
      return;
    }
    
    await updateAccount.mutateAsync({
      id: editingAccount.id,
      paypal_name: accountForm.paypal_name.trim(),
      note: accountForm.note.trim() || undefined,
      tag: accountForm.tag.trim() || null,
    });
    
    setAccountForm({ paypal_name: '', note: '', opening_balance_amount: '', tag: '' });
    setEditingAccount(null);
  };

  const confirmOpeningBalanceChange = async () => {
    if (!pendingOpeningBalanceChange) return;
    
    await updateAccount.mutateAsync(pendingOpeningBalanceChange);
    
    setAccountForm({ paypal_name: '', note: '', opening_balance_amount: '', tag: '' });
    setEditingAccount(null);
    setShowOpeningBalanceWarning(false);
    setPendingOpeningBalanceChange(null);
  };

  const handleToggleActive = async (account: PaypalAccount) => {
    await updateAccount.mutateAsync({
      id: account.id,
      is_active: !account.is_active,
    });
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return;
    await deleteAccount.mutateAsync(deleteAccountId);
    setDeleteAccountId(null);
  };

  const handleAddEmail = async () => {
    if (!manageEmailsFor || !newEmail.trim()) return;
    
    await createEmail.mutateAsync({
      paypal_account_id: manageEmailsFor.id,
      email: newEmail.trim(),
    });
    
    setNewEmail('');
  };

  const handleToggleEmailStatus = async (email: PaypalEmail) => {
    await updateEmail.mutateAsync({
      id: email.id,
      status: email.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' as EmailStatus,
    });
  };

  const handleSetPrimary = async (email: PaypalEmail) => {
    if (email.is_primary) return;
    await updateEmail.mutateAsync({
      id: email.id,
      is_primary: true,
    });
  };

  const handleDeleteEmail = async () => {
    if (!deleteEmailId) return;
    await deleteEmail.mutateAsync(deleteEmailId);
    setDeleteEmailId(null);
  };

  const getSummaryForAccount = (accountId: string) => {
    return summaryData?.find(s => s.id === accountId);
  };

  const getAuthoritativeBalanceForAccount = (accountId: string) => {
    const viewEntry = viewBalances?.find(v => v.id === accountId);
    return Number(viewEntry?.balance) || 0;
  };

  // Filter accounts by search query (wallet name or email)
  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    let filtered = accounts;
    
    // Filter by status
    if (statusFilter === 'active') {
      filtered = filtered.filter(account => account.is_active);
      filtered = filtered.filter(account => getAuthoritativeBalanceForAccount(account.id) > 0);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(account => !account.is_active);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const accountIdsWithMatchingEmails = new Set(
        (allEmails || [])
          .filter(email => email.email.toLowerCase().includes(query))
          .map(email => email.paypal_account_id)
      );
      filtered = filtered.filter(account => 
        account.paypal_name.toLowerCase().includes(query) ||
        accountIdsWithMatchingEmails.has(account.id)
      );
    }
    
    return filtered;
  }, [accounts, allEmails, searchQuery, statusFilter, viewBalances]);

  return (
    <AppLayout>
      <PageHeader 
        title="Wallet Accounts" 
        description="Manage wallet accounts and NPR accounts"
      />

      <Tabs defaultValue="wallets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wallets" className="gap-2">
            <Wallet className="h-4 w-4" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="nepali" className="gap-2">
            <Banknote className="h-4 w-4" />
            Nepali Account (NPR)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wallets">
          <div className="flex justify-end mb-4">
            <Button onClick={() => {
              setAccountForm({ paypal_name: '', note: '', opening_balance_amount: '', tag: '' });
              setShowCreateAccount(true);
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Wallet
            </Button>
          </div>

      {/* Search and Accounts Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant={statusFilter !== 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(prev => prev === 'active' ? 'inactive' : 'active')}
              >
                {statusFilter === 'inactive' ? 'Inactive' : 'Active'}
              </Button>
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
            </div>
            <div className="relative max-w-sm flex-1 ml-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by wallet name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="table-container">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Wallet Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Emails</TableHead>
                  <TableHead className="text-right">
                    Balance
                    {showSensitive && filteredAccounts.length > 0 && (
                      <div className="text-[11px] font-normal text-pink-500">
                        ${Math.round(filteredAccounts.reduce((sum, acc) => sum + getAuthoritativeBalanceForAccount(acc.id), 0)).toLocaleString()}
                      </div>
                    )}
                  </TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState 
                        icon={<Wallet className="h-6 w-6" />}
                        title={searchQuery ? "No matching wallets" : "No wallet accounts"}
                        description={searchQuery ? "Try a different search term" : "Create your first wallet account to start tracking transactions"}
                        action={
                          !searchQuery && (
                            <Button onClick={() => setShowCreateAccount(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Wallet
                            </Button>
                          )
                        }
                        className="my-8"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => {
                    const summary = getSummaryForAccount(account.id);
                    const authoritativeBalance = getAuthoritativeBalanceForAccount(account.id);
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">
                          {account.paypal_name}
                          {(account as any).tag && (
                            <span className="ml-2 text-[11px] font-medium text-pink-600 bg-pink-100 dark:text-pink-400 dark:bg-pink-950 rounded-full px-1.5 py-0.5">
                              {(account as any).tag}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={account.is_active ? 'active' : 'inactive'}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-center">
                          {summary?.active_emails_count || 0}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {showSensitive ? formatUSD(authoritativeBalance) : MASK}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {account.note || '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => setManageEmailsFor(account)}>
                                <Mail className="h-4 w-4 mr-2" />
                                Manage Emails
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setAccountForm({ 
                                  paypal_name: account.paypal_name, 
                                  note: account.note || '',
                                  opening_balance_amount: account.opening_balance_amount?.toString() || '',
                                  tag: (account as any).tag || '',
                                });
                                setEditingAccount(account);
                              }}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(account)}>
                                <Power className={`h-4 w-4 mr-2 ${account.is_active ? 'text-success' : 'text-muted-foreground'}`} />
                                {account.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteAccountId(account.id)} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Account Dialog */}
      <Dialog 
        open={showCreateAccount || !!editingAccount} 
        onOpenChange={() => {
          setShowCreateAccount(false);
          setEditingAccount(null);
          setAccountForm({ paypal_name: '', note: '', opening_balance_amount: '', tag: '' });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Wallet Account' : 'Add Wallet Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="form-field">
              <Label>Wallet Name *</Label>
              <Input
                placeholder="e.g., Business Wallet"
                value={accountForm.paypal_name}
                onChange={(e) => setAccountForm({ ...accountForm, paypal_name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="form-field">
              <Label>Tag</Label>
              <Input
                placeholder="e.g., PayPal, Skrill, Wise"
                value={accountForm.tag}
                onChange={(e) => setAccountForm({ ...accountForm, tag: e.target.value })}
              />
            </div>
            
            <div className="form-field">
              <Label>Opening Balance</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={accountForm.opening_balance_amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setAccountForm({ ...accountForm, opening_balance_amount: val });
                  }
                }}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            
            <div className="form-field">
              <Label>Note</Label>
              <Textarea
                placeholder="Optional description..."
                value={accountForm.note}
                onChange={(e) => setAccountForm({ ...accountForm, note: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateAccount(false);
                setEditingAccount(null);
                setAccountForm({ paypal_name: '', note: '', opening_balance_amount: '', tag: '' });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={editingAccount ? handleUpdateAccount : handleCreateAccount}
              disabled={!accountForm.paypal_name.trim() || createAccount.isPending || updateAccount.isPending}
            >
              {editingAccount ? 'Save Changes' : 'Add Wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Opening Balance Warning Dialog */}
      <Dialog open={showOpeningBalanceWarning} onOpenChange={setShowOpeningBalanceWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Confirm Opening Balance Change
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to change the Opening Balance? This will affect all wallet balance calculations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowOpeningBalanceWarning(false);
                setPendingOpeningBalanceChange(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmOpeningBalanceChange}
              disabled={updateAccount.isPending}
            >
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Emails Dialog */}
      <Dialog open={!!manageEmailsFor} onOpenChange={() => setManageEmailsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Manage Emails: {manageEmailsFor?.paypal_name}
            </DialogTitle>
          </DialogHeader>

          {/* Add Email Form */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Add new email address..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddEmail();
                }
              }}
            />
            <Button onClick={handleAddEmail} disabled={!newEmail.trim() || createEmail.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Emails List */}
          <div className="table-container max-h-[300px]">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Primary</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailsLoading ? (
                  [...Array(2)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(4)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : emails?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No emails added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  emails?.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="font-medium">{email.email}</TableCell>
                      <TableCell>
                        <StatusBadge variant={email.status === 'ACTIVE' ? 'active' : 'inactive'}>
                          {email.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {email.is_primary && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!email.is_primary && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSetPrimary(email)}
                              title="Set as Primary"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleEmailStatus(email)}
                            title={email.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          >
                            {email.status === 'ACTIVE' ? (
                              <X className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Check className="h-4 w-4 text-success" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteEmailId(email.id)}
                            title="Delete"
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageEmailsFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </TabsContent>

        <TabsContent value="nepali">
          <NepaliAccountsTab />
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation */}
      <ConfirmDialog
        open={!!deleteAccountId}
        onOpenChange={() => setDeleteAccountId(null)}
        title="Delete Wallet Account"
        description="Are you sure you want to delete this wallet account? This action cannot be undone and may affect existing transactions."
        confirmLabel="Delete"
        onConfirm={handleDeleteAccount}
        variant="destructive"
      />

      {/* Delete Email Confirmation */}
      <ConfirmDialog
        open={!!deleteEmailId}
        onOpenChange={() => setDeleteEmailId(null)}
        title="Delete Email"
        description="Are you sure you want to delete this email?"
        confirmLabel="Delete"
        onConfirm={handleDeleteEmail}
        variant="destructive"
      />
    </AppLayout>
  );
}
