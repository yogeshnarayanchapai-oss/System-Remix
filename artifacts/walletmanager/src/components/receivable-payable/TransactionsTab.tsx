import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Search, Calendar, Filter, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, Download, ArrowRightLeft } from 'lucide-react';
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
import { useNprTransfers, DatePreset, NprTransfer } from '@/hooks/useNprTransfers';
import { useDeleteNprTransfer, useUpdateNprTransfer } from '@/hooks/useNepaliAccounts';
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
  const [activityType, setActivityType] = useState<'ALL' | 'RECEIVABLE' | 'PAYABLE' | 'TRANSFERS'>('ALL');
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
  const [editTransfer, setEditTransfer] = useState<NprTransfer | null>(null);
  const [deleteTransfer, setDeleteTransfer] = useState<NprTransfer | null>(null);
  const [editTransferDate, setEditTransferDate] = useState('');
  const [editFromAccountId, setEditFromAccountId] = useState<string | null>(null);
  const [editToAccountId, setEditToAccountId] = useState<string | null>(null);
  const [editTransferAmount, setEditTransferAmount] = useState('');
  const [editTransferRemark, setEditTransferRemark] = useState('');

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
    remarkSearch: remarkSearch.trim() || undefined,
    page: 1,
    pageSize: 50,
  });
  const transferDatePreset: DatePreset = dateQuickFilter === 'today' ? 'today'
    : dateQuickFilter === '7days' ? 'last7'
    : dateQuickFilter === '30days' ? 'last30'
    : dateQuickFilter === 'this_month' ? 'thisMonth'
    : dateQuickFilter === 'last_month' ? 'lastMonth'
    : 'custom';
  const { data: transfers, isLoading: transfersLoading } = useNprTransfers({
    datePreset: transferDatePreset,
    customDateFrom: dateRange.from,
    customDateTo: dateRange.to,
    nepaliAccountId: selectedNprAccountId,
    remarkSearch: remarkSearch.trim() || undefined,
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
  const deleteTransferMutation = useDeleteNprTransfer();
  const updateTransferMutation = useUpdateNprTransfer();

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

  type ActivityRow =
    | { kind: 'transaction'; item: PartyTransactionWithDetails }
    | { kind: 'transfer'; item: NprTransfer };
  const activityRows = useMemo<ActivityRow[]>(() => {
    const transactionRows: ActivityRow[] = (transactionsData?.transactions || [])
      .filter((txn) => activityType === 'ALL' || (activityType === 'RECEIVABLE' && txn.entry_type === 'OUTGOING') || (activityType === 'PAYABLE' && txn.entry_type === 'INCOMING'))
      .map((item) => ({ kind: 'transaction', item }));
    const transferRows: ActivityRow[] = activityType === 'RECEIVABLE' || activityType === 'PAYABLE' || selectedPartyId
      ? []
      : (transfers || []).map((item) => ({ kind: 'transfer', item }));
    return [...transactionRows, ...transferRows].sort((a, b) => {
      const dateOf = (row: ActivityRow) => row.kind === 'transfer' ? row.item.transfer_date : row.item.entry_date;
      const keyOf = (row: ActivityRow) => row.kind === 'transfer' ? row.item.source_id : row.item.id;
      return dateOf(b).localeCompare(dateOf(a))
        || b.item.created_at.localeCompare(a.item.created_at)
        || keyOf(b).localeCompare(keyOf(a));
    });
  }, [transactionsData?.transactions, transfers, activityType, selectedPartyId]);
  const totalActivityPages = Math.max(1, Math.ceil(activityRows.length / 50));
  const visibleActivityRows = activityRows.slice((currentPage - 1) * 50, currentPage * 50);

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
      const rows = [
        ...transactions
          .filter((txn) => activityType === 'ALL' || (activityType === 'RECEIVABLE' && txn.entry_type === 'OUTGOING') || (activityType === 'PAYABLE' && txn.entry_type === 'INCOMING'))
          .map((txn) => ({
            date: txn.entry_date,
            createdAt: txn.created_at,
            id: txn.id,
            values: [txn.entry_date, txn.party_name, getEntryTypeLabel(txn.entry_type), txn.amount_npr, txn.nepali_account_name || 'None', txn.remark || ''],
          })),
        ...(activityType === 'RECEIVABLE' || activityType === 'PAYABLE' || selectedPartyId ? [] : (transfers || []).map((transfer) => ({
          date: transfer.transfer_date,
          createdAt: transfer.created_at,
          id: transfer.source_id,
          values: [transfer.transfer_date, `${transfer.from_account_name} → ${transfer.to_account_name}`, 'Transfer', transfer.amount_npr, `From: ${transfer.from_account_name}; To: ${transfer.to_account_name}`, transfer.remark || ''],
        }))),
      ];
      if (!rows.length) {
        toast.error('No filtered activities to export');
        return;
      }
      rows.sort((a, b) => b.date.localeCompare(a.date)
        || b.createdAt.localeCompare(a.createdAt)
        || b.id.localeCompare(a.id));
      downloadCsv(
        `receivable-payable-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`,
        ['Date', 'Party', 'Entry Type', 'Amount (NPR)', 'NPR Account', 'Remark'],
        rows.map((row) => row.values),
      );
      toast.success(`Exported ${rows.length} filtered activities`);
    } catch (error) {
      console.error('Failed to export party transactions:', error);
      toast.error('Could not export filtered transactions');
    } finally {
      setIsExporting(false);
    }
  };

  const openTransferEdit = async (transfer: NprTransfer) => {
    setEditTransfer(transfer);
    setEditTransferDate(transfer.transfer_date);
    setEditFromAccountId(transfer.from_account_id);
    setEditToAccountId(transfer.to_account_id);
    setEditTransferAmount(String(transfer.amount_npr));
    setEditTransferRemark(transfer.remark || '');
  };
  const handleSaveTransfer = async () => {
    if (!editTransfer) return;
    const amount = Number(editTransferAmount);
    if (!amount || amount <= 0) { toast.error('Invalid amount'); return; }
    if (!editFromAccountId && !editToAccountId) { toast.error('Select at least one account'); return; }
    if (editFromAccountId && editToAccountId && editFromAccountId === editToAccountId) {
      toast.error('From and To accounts must be different');
      return;
    }
    await updateTransferMutation.mutateAsync({
      sourceId: editTransfer.source_id,
      from_account_id: editFromAccountId,
      to_account_id: editToAccountId,
      amount_npr: amount,
      transfer_date: editTransferDate,
      remark: editTransferRemark || undefined,
    });
    setEditTransfer(null);
  };
  const handleDeleteTransfer = async () => {
    if (!deleteTransfer) return;
    await deleteTransferMutation.mutateAsync({ sourceId: deleteTransfer.source_id, meta: {
      amount_npr: deleteTransfer.amount_npr,
      from_account: deleteTransfer.from_account_name,
      to_account: deleteTransfer.to_account_name,
    }});
    setDeleteTransfer(null);
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
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting || isLoading || transfersLoading}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Activity</span>
            <Select value={activityType} onValueChange={(value) => { setActivityType(value as typeof activityType); setCurrentPage(1); }}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Activity</SelectItem>
                <SelectItem value="RECEIVABLE">Receivable</SelectItem>
                <SelectItem value="PAYABLE">Payable</SelectItem>
                <SelectItem value="TRANSFERS">Transfers</SelectItem>
              </SelectContent>
            </Select>
          </div>

        {/* Table */}
        <div className="table-container">
          <Table>
            <TableHeader className="table-sticky-header">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Party / Accounts</TableHead>
                <TableHead>Activity Type</TableHead>
                <TableHead className="text-right">Amount (NPR)</TableHead>
                <TableHead>NPR Account</TableHead>
                <TableHead className="text-right">Balance After (NPR)</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || transfersLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleActivityRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      icon={<Filter className="h-6 w-6" />}
                      title="No activity found"
                      description="Try adjusting your filters"
                      className="my-8"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleActivityRows.map((row) => row.kind === 'transaction' ? (() => {
                  const txn = row.item;
                  return <TableRow key={`txn-${txn.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(txn.party_id, txn.party_name)}>
                    <TableCell className="whitespace-nowrap">{format(new Date(txn.entry_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="font-medium">{txn.party_name}</TableCell>
                    <TableCell><StatusBadge variant={getEntryTypeVariant(txn.entry_type)}>{getEntryTypeLabel(txn.entry_type)}</StatusBadge></TableCell>
                    <TableCell className="text-right font-mono">{formatNPR(txn.amount_npr)}</TableCell>
                    <TableCell><span className={txn.nepali_account_name ? '' : 'text-muted-foreground'}>{txn.nepali_account_name || 'None'}</span></TableCell>
                    <TableCell className="text-right font-mono">{!txn.nepali_account_id ? '—' : nprBalanceHistoryLoading ? <Skeleton className="ml-auto h-5 w-24" /> : nprBalanceHistoryError ? 'Unavailable' : partyAccountBalanceText(txn.id)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={txn.remark || ''}>{txn.remark || '-'}</TableCell>
                    <TableCell><DropdownMenu><DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="bg-popover"><DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(txn); }}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem><DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteTarget(txn); }} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>;
                })() : (() => {
                  const transfer = row.item;
                  return <TableRow key={`transfer-${transfer.source_id}`}><TableCell className="whitespace-nowrap">{format(new Date(transfer.transfer_date), 'MMM d, yyyy')}</TableCell><TableCell className="font-medium">{transfer.from_account_name} → {transfer.to_account_name}</TableCell><TableCell><StatusBadge variant="settled"><ArrowRightLeft className="mr-1 h-3 w-3" />Transfer</StatusBadge></TableCell><TableCell className="text-right font-mono">{formatNPR(transfer.amount_npr)}</TableCell><TableCell>From: {transfer.from_account_name}<br />To: {transfer.to_account_name}</TableCell><TableCell className="text-right font-mono text-xs">{nprBalanceHistoryLoading ? <Skeleton className="ml-auto h-5 w-24" /> : nprBalanceHistoryError ? 'Unavailable' : <><div>From: {transfer.from_account_id ? nprBalanceHistory?.transferBalanceAfter[transfer.source_id]?.from != null ? formatNPR(nprBalanceHistory.transferBalanceAfter[transfer.source_id].from!) : '—' : '—'}</div><div>To: {transfer.to_account_id ? nprBalanceHistory?.transferBalanceAfter[transfer.source_id]?.to != null ? formatNPR(nprBalanceHistory.transferBalanceAfter[transfer.source_id].to!) : '—' : '—'}</div></>}</TableCell><TableCell className="max-w-[200px] truncate">{transfer.remark || '-'}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="bg-popover"><DropdownMenuItem onClick={() => openTransferEdit(transfer)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem><DropdownMenuItem onClick={() => setDeleteTransfer(transfer)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>;
                })())
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalActivityPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalActivityPages} ({activityRows.length} entries)
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
                onClick={() => setCurrentPage(p => Math.min(totalActivityPages, p + 1))}
                disabled={currentPage === totalActivityPages}
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
      <ConfirmDialog
        open={!!deleteTransfer}
        onOpenChange={(open) => !open && setDeleteTransfer(null)}
        title="Delete NPR Transfer"
        description={`Delete transfer of ${deleteTransfer ? formatNPR(deleteTransfer.amount_npr) : ''} from ${deleteTransfer?.from_account_name} to ${deleteTransfer?.to_account_name}?`}
        onConfirm={handleDeleteTransfer}
        variant="destructive"
      />
      <Dialog open={!!editTransfer} onOpenChange={(open) => !open && setEditTransfer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit NPR Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={editTransferDate} onChange={(e) => setEditTransferDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>From Account</Label><NepaliAccountSelect value={editFromAccountId} onChange={setEditFromAccountId} placeholder="None" /></div>
            <div className="space-y-1.5"><Label>To Account</Label><NepaliAccountSelect value={editToAccountId} onChange={setEditToAccountId} placeholder="None" /></div>
            <div className="space-y-1.5"><Label>Amount (NPR)</Label><Input inputMode="decimal" value={editTransferAmount} onChange={(e) => setEditTransferAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Remark</Label><Input value={editTransferRemark} onChange={(e) => setEditTransferRemark(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditTransfer(null)}>Cancel</Button><Button onClick={handleSaveTransfer} disabled={updateTransferMutation.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
