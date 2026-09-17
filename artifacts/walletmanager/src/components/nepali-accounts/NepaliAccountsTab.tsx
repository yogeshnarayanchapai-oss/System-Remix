import { useState, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NepaliAccountModal } from './NepaliAccountModal';
import { useNepaliAccountsWithBalances, useUpdateNepaliAccount, useDeleteNepaliAccount, NepaliAccountWithBalance } from '@/hooks/useNepaliAccounts';
import { useUserRole } from '@/hooks/useUserRole';
import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatNPR } from '@/lib/format';

interface NepaliAccountsTabProps {
  hideSmallBalances: boolean;
}

export function NepaliAccountsTab({ hideSmallBalances }: NepaliAccountsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<NepaliAccountWithBalance | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  
  const { data: accounts, isLoading } = useNepaliAccountsWithBalances();
  const { isAdmin } = useUserRole();
  const { isVisible: showSensitive, MASK } = useSensitiveDataVisibility();
  const updateAccount = useUpdateNepaliAccount();
  const deleteAccount = useDeleteNepaliAccount();

  const getAvailableBalance = (account: NepaliAccountWithBalance) => Number(account.available_balance_npr) || 0;

  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];
    let filtered = accounts;
    if (statusFilter === 'active') {
      filtered = filtered.filter(account => account.status === 'ACTIVE' && getAvailableBalance(account) > 0);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(account => account.status === 'INACTIVE');
    }
    if (hideSmallBalances) {
      filtered = filtered.filter(account => Math.abs(getAvailableBalance(account)) >= 1);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(account => account.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [accounts, searchQuery, statusFilter, hideSmallBalances]);

  const handleEdit = (account: NepaliAccountWithBalance) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const handleToggleStatus = async (account: NepaliAccountWithBalance) => {
    await updateAccount.mutateAsync({
      id: account.id,
      status: account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
  };

  const handleDelete = async () => {
    if (!deleteAccountId) return;
    await deleteAccount.mutateAsync(deleteAccountId);
    setDeleteAccountId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1" />
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Nepali Account
        </Button>
      </div>

      {filteredAccounts.length > 0 || statusFilter !== 'all' || searchQuery ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-muted/30">
            <div className="flex items-center gap-1">
              <Button
                variant={statusFilter !== 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(prev => prev === 'active' ? 'inactive' : 'active')}
                className="h-8 text-xs"
              >
                {statusFilter === 'inactive' ? 'Inactive' : 'Active'}
              </Button>
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="h-8 text-xs"
              >
                All
              </Button>
            </div>
            <div className="relative max-w-sm flex-1 ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                {isAdmin && <TableHead className="text-right">Available Balance</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right font-semibold">
                      {showSensitive ? formatNPR(getAvailableBalance(account)) : MASK}
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge 
                      variant={account.status === 'ACTIVE' ? 'active' : 'inactive'}
                    >
                      {account.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => handleEdit(account)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(account)}>
                          <Power className={`h-4 w-4 mr-2 ${account.status === 'ACTIVE' ? 'text-success' : 'text-muted-foreground'}`} />
                          {account.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteAccountId(account.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No Nepali Accounts"
          description="Create your first Nepali Account to track NPR balances."
          action={
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Nepali Account
            </Button>
          }
        />
      )}

      <NepaliAccountModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        account={editingAccount}
      />

      <ConfirmDialog
        open={!!deleteAccountId}
        onOpenChange={() => setDeleteAccountId(null)}
        title="Delete Nepali Account"
        description="Are you sure you want to delete this account? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
