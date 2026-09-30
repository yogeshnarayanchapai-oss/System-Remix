import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { format, subDays } from 'date-fns';
import { 
  Search, 
  Download, 
  ArrowDownLeft, 
  ArrowUpRight,
  Edit2,
  Trash2,
  ArrowRightLeft,
  Layers,
  MoreHorizontal,
  CalendarIcon
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useWalletTransfers, useDeleteWalletTransfer } from '@/hooks/useWalletTransfers';
import { useUsdAccountBalanceHistory } from '@/hooks/useAccountBalanceHistory';
import { useActivePaypalAccounts } from '@/hooks/usePaypalAccounts';
import { useParties } from '@/hooks/useParties';
import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatDate, formatUSD, formatNumber } from '@/lib/format';
import { Transaction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BulkTransactionModal } from '@/components/transactions/BulkTransactionModal';
import { TransferModal } from '@/components/transfers/TransferModal';

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const initialDateFrom = searchParams.get('dateFrom');
  const initialDateTo = searchParams.get('dateTo');
  const [activityType, setActivityType] = useState<'ALL' | 'INCOMING' | 'OUTGOING' | 'TRANSFER'>('ALL');
  const [search, setSearch] = useState('');
  const [walletFilter, setWalletFilter] = useState<string>('ALL');
  const [partyFilter, setPartyFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'custom'>(
    initialDateFrom || initialDateTo ? 'custom' : 'today',
  );
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(
    initialDateFrom ? new Date(`${initialDateFrom}T00:00:00`) : undefined,
  );
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(
    initialDateTo ? new Date(`${initialDateTo}T00:00:00`) : undefined,
  );

  const dateFilters = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (datePreset === 'today') return { dateFrom: today, dateTo: today };
    if (datePreset === '7days') return { dateFrom: format(subDays(new Date(), 7), 'yyyy-MM-dd'), dateTo: today };
    if (datePreset === '30days') return { dateFrom: format(subDays(new Date(), 30), 'yyyy-MM-dd'), dateTo: today };
    if (datePreset === 'custom') {
      return {
        dateFrom: customDateFrom ? format(customDateFrom, 'yyyy-MM-dd') : undefined,
        dateTo: customDateTo ? format(customDateTo, 'yyyy-MM-dd') : undefined,
      };
    }
    return {};
  }, [datePreset, customDateFrom, customDateTo]);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTransferId, setDeleteTransferId] = useState<string | null>(null);

  const { data: transactions, isLoading } = useTransactions({
    paypalAccountId: walletFilter === 'ALL' ? undefined : walletFilter,
    partyId: partyFilter === 'ALL' ? undefined : partyFilter,
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
  });
  const { data: transfers, isLoading: transfersLoading } = useWalletTransfers({
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
    walletId: walletFilter === 'ALL' ? undefined : walletFilter,
  });
  const {
    data: usdBalanceHistory,
    isLoading: usdBalanceHistoryLoading,
    isError: usdBalanceHistoryError,
  } = useUsdAccountBalanceHistory();
  const { data: walletAccounts } = useActivePaypalAccounts();
  const { data: parties } = useParties();
  const { isVisible: showSensitive, MASK } = useSensitiveDataVisibility();

  type ActivityRow =
    | { kind: 'transaction'; activityDate: string; createdAt: string; id: string; transaction: Transaction }
    | { kind: 'transfer'; activityDate: string; createdAt: string; id: string; transfer: NonNullable<typeof transfers>[number] };

  const activityRows = useMemo<ActivityRow[]>(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const transactionRows: ActivityRow[] = (transactions || [])
      .filter((txn) => activityType === 'ALL' || activityType === txn.txn_type)
      .filter((txn) => !normalizedSearch || [
        txn.parties?.party_name,
        txn.paypal_accounts?.paypal_name,
        txn.paypal_emails?.email,
        txn.remark,
        txn.reference_id,
        txn.amount,
        txn.rate,
        txn.total,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)))
      .map((transaction) => ({
        kind: 'transaction',
        activityDate: transaction.txn_date,
        createdAt: transaction.created_at,
        id: transaction.id,
        transaction,
      }));
    const transferRows: ActivityRow[] = (transfers || [])
      .filter(() => partyFilter === 'ALL')
      .filter(() => activityType === 'ALL' || activityType === 'TRANSFER')
      .filter((transfer) => !normalizedSearch || [
        transfer.from_wallet?.paypal_name,
        transfer.to_wallet?.paypal_name,
        transfer.remark,
        transfer.amount,
        transfer.fee,
        transfer.total,
      ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)))
      .map((transfer) => ({
        kind: 'transfer',
        activityDate: transfer.transfer_date,
        createdAt: transfer.created_at,
        id: transfer.id,
        transfer,
      }));
    return [...transactionRows, ...transferRows].sort((a, b) =>
      b.activityDate.localeCompare(a.activityDate)
      || b.createdAt.localeCompare(a.createdAt)
      || b.id.localeCompare(a.id)
    );
  }, [transactions, transfers, activityType, search, partyFilter]);

  const transactionBalanceText = (transactionId: string) => {
    const balance = usdBalanceHistory?.transactionBalanceAfter[transactionId];
    if (!showSensitive) return MASK;
    return balance !== undefined ? formatUSD(balance) : '—';
  };
  const transferBalanceText = (transferId: string, side: 'from' | 'to') => {
    const balance = usdBalanceHistory?.transferBalanceAfter[transferId]?.[side];
    if (!showSensitive) return MASK;
    return balance != null ? formatUSD(balance) : '—';
  };
  
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const deleteTransfer = useDeleteWalletTransfer();

  const { user } = useAuth();
  const { role } = useUserRole();
  const isAdmin = user && role === "ADMIN";

  const notifyAdmin = () => toast.error("Contact Admin to perform this action");

  const handleEdit = (txn: Transaction) => {
    if (!isAdmin) { notifyAdmin(); return; }
    setEditingTxn(txn);
  };
  const handleUpdateSubmit = async () => {
    if (!editingTxn) return;
    await updateTransaction.mutateAsync({
      id: editingTxn.id, txn_date: editingTxn.txn_date, txn_type: editingTxn.txn_type,
      party_id: editingTxn.party_id, paypal_account_id: editingTxn.paypal_account_id,
      paypal_email_id: editingTxn.paypal_email_id, amount: editingTxn.amount, rate: editingTxn.rate,
      total: editingTxn.amount * editingTxn.rate, remark: editingTxn.remark || undefined,
    });
    setEditingTxn(null);
  };

  const handleDelete = async () => { 
    if (deleteId) { 
      await deleteTransaction.mutateAsync(deleteId); 
      setDeleteId(null); 
    } 
  };

  const handleDeleteTransfer = async () => {
    if (deleteTransferId) {
      await deleteTransfer.mutateAsync({ id: deleteTransferId });
      setDeleteTransferId(null);
    }
  };

  const exportCSV = () => {
    if (!activityRows.length) return;
    const headers = ['Date', 'Activity', 'Party', 'From / Wallet', 'To / Email', 'Amount (USD)', 'Details', 'Remark'];
    const rows = activityRows.map((row) => row.kind === 'transaction'
      ? [row.transaction.txn_date, row.transaction.txn_type, row.transaction.parties?.party_name || '', row.transaction.paypal_accounts?.paypal_name || '', row.transaction.paypal_emails?.email || '', row.transaction.amount, `Rate: ${row.transaction.rate}; NPR Total: ${row.transaction.total}`, row.transaction.remark || '']
      : [row.transfer.transfer_date, 'TRANSFER', '', row.transfer.from_wallet?.paypal_name || 'None', row.transfer.to_wallet?.paypal_name || 'None', row.transfer.amount, `Fee: ${row.transfer.fee}; Total Deducted: ${row.transfer.total}`, row.transfer.remark || '']);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Transactions" 
        description="Record and manage all wallet transactions"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTransferModal(true)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />Transfer
            </Button>
            <Button onClick={() => setShowBulkModal(true)}>
              <Layers className="mr-2 h-4 w-4" />Bulk Transaction
            </Button>
          </div>
        }
      />

      <div className="mb-6">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                 <div className="form-field min-w-[200px] flex-1"><Label>Search</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search party, wallet, remark, amount..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div></div>
                <div className="form-field min-w-[180px]"><Label>Wallet</Label><Select value={walletFilter} onValueChange={setWalletFilter}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="ALL">All Wallets</SelectItem>{walletAccounts?.map((account) => (<SelectItem key={account.id} value={account.id}>{account.paypal_name}{(account as any).tag && <span className="ml-1.5 text-[10px] font-medium text-pink-600 dark:text-pink-400">{(account as any).tag}</span>}</SelectItem>))}</SelectContent></Select></div>
                <div className="form-field min-w-[180px]"><Label>Party</Label><Select value={partyFilter} onValueChange={setPartyFilter}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="ALL">All Parties</SelectItem>{parties?.map((party) => (<SelectItem key={party.id} value={party.id}>{party.party_name}</SelectItem>))}</SelectContent></Select></div>
                 <div className="form-field min-w-[160px]"><Label>Activity</Label><Select value={activityType} onValueChange={(value) => setActivityType(value as typeof activityType)}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="ALL">All Activity</SelectItem><SelectItem value="INCOMING">Incoming</SelectItem><SelectItem value="OUTGOING">Outgoing</SelectItem><SelectItem value="TRANSFER">Transfers</SelectItem></SelectContent></Select></div>
                <div className="form-field min-w-[180px]">
                  <Label>Date</Label>
                  <div className="flex items-center gap-1">
                    {([
                      { value: 'today', label: 'Today' },
                      { value: '7days', label: '7D' },
                      { value: '30days', label: '30D' },
                      { value: 'custom', label: 'Custom' },
                    ] as const).map((preset) => (
                      <Button
                        key={preset.value}
                        variant={datePreset === preset.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setDatePreset(preset.value)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {datePreset === 'custom' && (
                  <div className="flex items-end gap-2">
                    <div className="form-field">
                      <Label>From</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal h-9 text-xs", !customDateFrom && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {customDateFrom ? format(customDateFrom, "MMM dd") : "Start"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="form-field">
                      <Label>To</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal h-9 text-xs", !customDateTo && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {customDateTo ? format(customDateTo, "MMM dd") : "End"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
                 <Button variant="outline" onClick={exportCSV} disabled={!activityRows.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="table-container max-h-[600px]">
                <Table>
                  <TableHeader className="table-sticky-header">
                    <TableRow>
                       <TableHead>Date</TableHead><TableHead>Activity</TableHead><TableHead>Party / From</TableHead><TableHead>Wallet / To</TableHead><TableHead>Details</TableHead>
                       <TableHead className="text-right">Amount (USD)</TableHead>
                      <TableHead className="text-right">Balance After (USD)</TableHead>
                      <TableHead>Remark</TableHead><TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {isLoading || transfersLoading ? ([...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(9)].map((_, j) => (<TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>))}</TableRow>)))
                     : activityRows.length === 0 ? (<TableRow><TableCell colSpan={9}><EmptyState title="No activity found" description="Try adjusting your filters" className="my-8" /></TableCell></TableRow>)
                     : activityRows.map((row) => {
                       if (row.kind === 'transaction') {
                         const txn = row.transaction;
                         return <TableRow key={`transaction-${txn.id}`}>
                         <TableCell className="whitespace-nowrap">{formatDate(txn.txn_date)}</TableCell>
                         <TableCell><StatusBadge variant={txn.txn_type === 'INCOMING' ? 'incoming' : 'outgoing'}>{txn.txn_type === 'INCOMING' ? <><ArrowDownLeft className="mr-1 h-3 w-3" /> Incoming</> : <><ArrowUpRight className="mr-1 h-3 w-3" /> Outgoing</>}</StatusBadge></TableCell>
                         <TableCell className="font-medium">{txn.parties?.party_name}</TableCell>
                         <TableCell>{txn.paypal_accounts?.paypal_name}{(txn.paypal_accounts as any)?.tag && <span className="ml-1.5 text-[10px] font-medium text-pink-600 dark:text-pink-400">{(txn.paypal_accounts as any).tag}</span>}<div className="text-xs text-muted-foreground">{txn.paypal_emails?.email || '-'}</div></TableCell>
                         <TableCell className="text-xs text-muted-foreground">Rate: {showSensitive ? txn.rate.toFixed(2) : MASK}<br />NPR Total: {showSensitive ? formatNumber(txn.total) : MASK}</TableCell>
                         <TableCell className="text-right font-mono">{showSensitive ? formatUSD(txn.amount) : MASK}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {!txn.paypal_account_id ? '—' : usdBalanceHistoryLoading ? <Skeleton className="ml-auto h-5 w-20" /> : usdBalanceHistoryError ? (
                            <span title="Could not load account balance">Unavailable</span>
                          ) : usdBalanceHistory?.transactionBalanceAfter[txn.id] !== undefined ? (
                            transactionBalanceText(txn.id)
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{txn.remark || '-'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => handleEdit(txn)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { if (!isAdmin) { notifyAdmin(); return; } setDeleteId(txn.id); }} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                       </TableRow>;
                       }
                       const transfer = row.transfer;
                       const fee = transfer.total - transfer.amount;
                       return <TableRow key={`transfer-${transfer.id}`}>
                         <TableCell className="whitespace-nowrap">{formatDate(transfer.transfer_date)}</TableCell>
                         <TableCell><StatusBadge variant="settled"><ArrowRightLeft className="mr-1 h-3 w-3" /> Transfer</StatusBadge></TableCell>
                         <TableCell className="font-medium">{transfer.from_wallet?.paypal_name || 'None'}</TableCell>
                         <TableCell className="font-medium">{transfer.to_wallet?.paypal_name || 'None'}</TableCell>
                         <TableCell className="text-xs text-muted-foreground">Fee: {showSensitive ? formatUSD(fee) : MASK}<br />Total Deducted: {showSensitive ? formatUSD(transfer.total) : MASK}</TableCell>
                         <TableCell className="text-right font-mono">{showSensitive ? formatUSD(transfer.amount) : MASK}</TableCell>
                         <TableCell className="text-right font-mono text-xs">
                           <div>From: {!transfer.from_wallet_id ? '—' : usdBalanceHistoryLoading ? <Skeleton className="ml-auto h-4 w-20" /> : usdBalanceHistoryError ? 'Unavailable' : transferBalanceText(transfer.id, 'from')}</div>
                           <div>To: {!transfer.to_wallet_id ? '—' : usdBalanceHistoryLoading ? <Skeleton className="ml-auto h-4 w-20" /> : usdBalanceHistoryError ? 'Unavailable' : transferBalanceText(transfer.id, 'to')}</div>
                         </TableCell>
                         <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{transfer.remark || '-'}</TableCell>
                         <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="bg-popover"><DropdownMenuItem onClick={() => { if (!isAdmin) { notifyAdmin(); return; } setDeleteTransferId(transfer.id); }} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                       </TableRow>;
                     })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
         </div>

      <BulkTransactionModal open={showBulkModal} onOpenChange={setShowBulkModal} />
      <TransferModal open={showTransferModal} onOpenChange={setShowTransferModal} />

      <Dialog open={!!editingTxn} onOpenChange={() => setEditingTxn(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>{editingTxn && (<div className="space-y-4"><div className="form-field"><Label>Date</Label><Input type="date" value={editingTxn.txn_date} onChange={(e) => setEditingTxn({...editingTxn, txn_date: e.target.value})} /></div><div className="form-field"><Label>Amount</Label><Input type="text" inputMode="decimal" value={editingTxn.amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setEditingTxn({...editingTxn, amount: parseFloat(val) || 0}); }} className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div><div className="form-field"><Label>Rate</Label><Input type="text" inputMode="decimal" value={editingTxn.rate} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setEditingTxn({...editingTxn, rate: parseFloat(val) || 0}); }} className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div><div className="form-field"><Label>NPR Total</Label><Input type="text" value={formatNumber(editingTxn.amount * editingTxn.rate)} readOnly className="bg-muted" /></div><div className="form-field"><Label>Remark</Label><Input value={editingTxn.remark || ''} onChange={(e) => setEditingTxn({...editingTxn, remark: e.target.value})} /></div></div>)}<DialogFooter><Button variant="outline" onClick={() => setEditingTxn(null)}>Cancel</Button><Button onClick={handleUpdateSubmit} disabled={updateTransaction.isPending}>Save</Button></DialogFooter></DialogContent></Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete Transaction" description="Are you sure you want to delete this transaction? This action cannot be undone." confirmLabel="Delete" onConfirm={handleDelete} variant="destructive" />
      <ConfirmDialog open={!!deleteTransferId} onOpenChange={() => setDeleteTransferId(null)} title="Delete Transfer" description="Are you sure you want to delete this transfer? This will affect wallet balance calculations." confirmLabel="Delete" onConfirm={handleDeleteTransfer} variant="destructive" />
    </AppLayout>
  );
}
