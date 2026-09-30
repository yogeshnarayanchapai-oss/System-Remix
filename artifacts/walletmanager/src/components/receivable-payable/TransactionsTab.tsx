import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Calendar, Filter, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAllPartyTransactions, fetchAllPartyTransactions, DateQuickFilter, getDateRangeFromFilter, PartyTransactionWithDetails } from '@/hooks/useAllPartyTransactions';
import { useUpdatePartyTransaction, useDeletePartyTransaction } from '@/hooks/usePartyTransactions';
import { useParties } from '@/hooks/useParties';
import { useNepaliAccounts } from '@/hooks/useNepaliAccounts';
import { useNprAccountBalanceHistory } from '@/hooks/useAccountBalanceHistory';
import { formatNPR } from '@/lib/format';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { NepaliAccountSelect } from '@/components/nepali-accounts/NepaliAccountSelect';
import { PartySummary } from '@/lib/types';
import { toast } from 'sonner';
import { downloadCsv } from '@/lib/csv';

interface TransactionsTabProps {
  onViewParty?: (party: PartySummary) => void;
  initialDateFrom?: string;
  initialDateTo?: string;
}

export function TransactionsTab({ onViewParty, initialDateFrom, initialDateTo }: TransactionsTabProps) {
  // Filter states
  const [dateQuickFilter, setDateQuickFilter] = useState<DateQuickFilter>(
    initialDateFrom || initialDateTo ? 'custom' : '7days',
  );
  const [customFromDate, setCustomFromDate] = useState<Date | undefined>(
    initialDateFrom ? new Date(`${initialDateFrom}T00:00:00`) : undefined,
  );
  const [customToDate, setCustomToDate] = useState<Date | undefined>(
    initialDateTo ? new Date(`${initialDateTo}T00:00:00`) : undefined,
  );
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedNprAccountId, setSelectedNprAccountId] = useState<string>('all');
  const [remarkSearch, setRemarkSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Edit/Delete states
  const [editTarget, setEditTarget] = useState<PartyTransactionWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartyTransactionWithDetails | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<string>('');
  const [editAmount, setEditAmount] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [editNepaliAccountId, setEditNepaliAccountId] = useState<string | null>(null);

  // Get date range based on filter
  const dateRange = useMemo(() => {
    return getDateRangeFromFilter(
      dateQuickFilter,
      customFromDate ? format(customFromDate, 'yyyy-MM-dd') : undefined,
      customToDate ? format(customToDate, 'yyyy-MM-dd') : undefined
    );
  }, [dateQuickFilter, customFromDate, customToDate]);

  // Fetch data
  const { data: partiesData } = useParties();
  const { data: nepaliAccounts } = useNepaliAccounts(true);
  const { data: transactionsData, isLoading } = useAllPartyTransactions({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    partyId: selectedPartyId || undefined,
    nepaliAccountId: selectedNprAccountId,
    remarkSearch: remarkSearch || undefined,
    page: currentPage,
    pageSize: 50,
  });
  const {
    data: nprBalanceHistory,
    isLoading: nprBalanceHistoryLoading,
    isError: nprBalanceHistoryError,
  } = useNprAccountBalanceHistory();
  const partyAccountBalanceText = (transactionId: string) => {
    const balance = nprBalanceHistory?.partyTransactionBalanceAfter[transactionId];
    return balance !== undefined ? formatNPR(balance) : '—';
  };

  const updateMutation = useUpdatePartyTransaction();
  const deleteMutation = useDeletePartyTransaction();

  // Party options for searchable select
  const partyOptions = useMemo(() => {
    return (partiesData || []).map(p => ({
      value: p.id,
      label: p.party_name,
    }));
  }, [partiesData]);

  const handlePartyChange = (value: string | null) => {
    setSelectedPartyId(value || '');
    setCurrentPage(1);
  };

  const handleNprAccountChange = (value: string) => {
    setSelectedNprAccountId(value);
    setCurrentPage(1);
  };

  const handleRemarkSearch = (value: string) => {
    setRemarkSearch(value);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (filter: DateQuickFilter) => {
    setDateQuickFilter(filter);
    setCurrentPage(1);
  };

  const handleRowClick = (partyId: string, partyName: string) => {
    if (onViewParty) {
      onViewParty({
        id: partyId,
        party_name: partyName,
        phone: null,
        receivable: 0,
        payable: 0,
        receivableUsd: 0,
        payableUsd: 0,
        net: 0,
        unsettled_count: 0,
        status: 'SETTLED',
      });
    }
  };

  const openEdit = (txn: PartyTransactionWithDetails) => {
    setEditTarget(txn);
    setEditDate(txn.entry_date);
    setEditType(txn.entry_type);
    setEditAmount(String(txn.amount_npr));
    setEditRemark(txn.remark || '');
    setEditNepaliAccountId(txn.nepali_account_id);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Invalid amount');
      return;
    }
    await updateMutation.mutateAsync({
      id: editTarget.id,
      data: {
        entry_date: editDate,
        entry_type: editType as 'INCOMING' | 'OUTGOING',
        amount_npr: amt,
        remark: editRemark || null,
        nepali_account_id: editNepaliAccountId || null,
      },
    });
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const getEntryTypeLabel = (entryType: string) => {
    switch (entryType) {
      case 'OUTGOING': return 'Outgoing';
      case 'INCOMING': return 'Incoming';
      default: return entryType;
    }
  };

  const getEntryTypeVariant = (entryType: string): 'receivable' | 'payable' | 'settled' => {
    return entryType === 'OUTGOING' ? 'receivable' : 'payable';
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const transactions = await fetchAllPartyTransactions({
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        partyId: selectedPartyId || undefined,
        nepaliAccountId: selectedNprAccountId,
        remarkSearch: remarkSearch.trim() || undefined,
      });
      if (!transactions.length) {
        toast.error('No filtered transactions to export');
        return;
      }

      downloadCsv(
        `receivable-payable-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`,
        ['Date', 'Party', 'Entry Type', 'Amount (NPR)', 'NPR Account', 'Remark'],
        transactions.map((txn) => [
          txn.entry_date,
          txn.party_name,
          getEntryTypeLabel(txn.entry_type),
          txn.amount_npr,
          txn.nepali_account_name || 'None',
          txn.remark || '',
        ]),
      );
      toast.success(`Exported ${transactions.length} filtered transactions`);
    } catch (error) {
      console.error('Failed to export party transactions:', error);
      toast.error('Could not export filtered transactions');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-5 w-5" />
          Party Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters Row */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {/* Date Quick Filters */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Date</span>
            <div className="flex gap-1">
              {(['today', '7days', '30days', 'this_month', 'last_month'] as DateQuickFilter[]).map((filter) => (
                <Button
                  key={filter}
                  variant={dateQuickFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleDateFilterChange(filter)}
                >
                  {filter === 'today' ? 'Today' : 
                   filter === '7days' ? '7D' : 
                   filter === '30days' ? '30D' : 
                   filter === 'this_month' ? 'This Month' : 'Last Month'}
                </Button>
              ))}
              <Button
                variant={dateQuickFilter === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handleDateFilterChange('custom')}
              >
                Custom
              </Button>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateQuickFilter === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 min-w-[100px] justify-start px-2 text-xs">
                    <Calendar className="mr-1.5 h-3 w-3" />
                    {customFromDate ? format(customFromDate, 'MMM d') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customFromDate}
                    onSelect={(d) => { setCustomFromDate(d); setCurrentPage(1); }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">-</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 min-w-[100px] justify-start px-2 text-xs">
                    <Calendar className="mr-1.5 h-3 w-3" />
                    {customToDate ? format(customToDate, 'MMM d') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customToDate}
                    onSelect={(d) => { setCustomToDate(d); setCurrentPage(1); }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Party Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Party</span>
            <div className="w-[180px]">
              <SearchableSelect
                value={selectedPartyId}
                onValueChange={(value) => handlePartyChange(value || null)}
                options={[{ value: '', label: 'All Parties' }, ...partyOptions]}
                placeholder="All Parties"
                emptyText="No parties found"
              />
            </div>
          </div>

          {/* NPR Account Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">NPR Account</span>
            <Select value={selectedNprAccountId} onValueChange={handleNprAccountChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="none">None (Unaccounted)</SelectItem>
                {nepaliAccounts?.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Remark Search */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Remark</span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by remark..."
                value={remarkSearch}
                onChange={(e) => handleRemarkSearch(e.target.value)}
                className="h-8 w-[180px] pl-7 text-xs"
              />
            </div>
          </div>
        </div>
          <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting || isLoading}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>

        {/* Table */}
        <div className="table-container">
          <Table>
            <TableHeader className="table-sticky-header">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Entry Type</TableHead>
                <TableHead className="text-right">Amount (NPR)</TableHead>
                <TableHead>NPR Account</TableHead>
                <TableHead className="text-right">Balance After (NPR)</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transactionsData?.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      icon={<Filter className="h-6 w-6" />}
                      title="No transactions found"
                      description="Try adjusting your filters"
                      className="my-8"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                transactionsData?.transactions.map((txn) => (
                  <TableRow 
                    key={txn.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(txn.party_id, txn.party_name)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(txn.entry_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">{txn.party_name}</TableCell>
                    <TableCell>
                      <StatusBadge variant={getEntryTypeVariant(txn.entry_type)}>
                        {getEntryTypeLabel(txn.entry_type)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNPR(txn.amount_npr)}
                    </TableCell>
                    <TableCell>
                      <span className={txn.nepali_account_name ? '' : 'text-muted-foreground'}>
                        {txn.nepali_account_name || 'None'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {!txn.nepali_account_id ? '—' : nprBalanceHistoryLoading ? (
                        <Skeleton className="ml-auto h-5 w-24" />
                      ) : nprBalanceHistoryError ? (
                        <span title="Could not load NPR account balance">Unavailable</span>
                      ) : partyAccountBalanceText(txn.id)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={txn.remark || ''}>
                      {txn.remark || '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(txn); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(txn); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {transactionsData && transactionsData.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {transactionsData.currentPage} of {transactionsData.totalPages} ({transactionsData.totalCount} entries)
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(transactionsData.totalPages, p + 1))}
                disabled={currentPage === transactionsData.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit Entry - {editTarget?.party_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Entry Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="INCOMING">Incoming</SelectItem>
                  <SelectItem value="OUTGOING">Outgoing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (NPR)</Label>
              <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} min="0" step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>NPR Account</Label>
            <NepaliAccountSelect
                value={editNepaliAccountId}
                onChange={(v) => setEditNepaliAccountId(v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Remark</Label>
              <Input value={editRemark} onChange={(e) => setEditRemark(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Entry"
        description={`Delete ${deleteTarget?.entry_type} entry of ${deleteTarget ? formatNPR(deleteTarget.amount_npr) : ''} for ${deleteTarget?.party_name}?`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </Card>
  );
}
