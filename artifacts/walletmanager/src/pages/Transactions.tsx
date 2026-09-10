import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { format, subDays, startOfDay } from 'date-fns';
import { 
  Search, 
  Download, 
  ArrowDownLeft, 
  ArrowUpRight,
  Edit2,
  Trash2,
  ArrowRightLeft,
  Layers,
  Plus,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useWalletTransfers, useDeleteWalletTransfer } from '@/hooks/useWalletTransfers';
import { useActivePaypalAccounts } from '@/hooks/usePaypalAccounts';
import { useParties } from '@/hooks/useParties';
import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatDate, formatUSD, formatNumber } from '@/lib/format';
import { TxnType, Transaction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BulkTransactionModal } from '@/components/transactions/BulkTransactionModal';
import { TransferModal } from '@/components/transfers/TransferModal';

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const initialDateFrom = searchParams.get('dateFrom');
  const initialDateTo = searchParams.get('dateTo');
  const [activeTab, setActiveTab] = useState('transactions');
  const [txnSubTab, setTxnSubTab] = useState<'incoming' | 'outgoing'>('incoming');
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
    txnType: txnSubTab === 'incoming' ? 'INCOMING' : 'OUTGOING',
    paypalAccountId: walletFilter === 'ALL' ? undefined : walletFilter,
    partyId: partyFilter === 'ALL' ? undefined : partyFilter,
    search,
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
  });
  const { data: transfers, isLoading: transfersLoading } = useWalletTransfers();
  const { data: walletAccounts } = useActivePaypalAccounts();
  const { data: parties } = useParties();
  const { isVisible: showSensitive, MASK } = useSensitiveDataVisibility();
  
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
    if (!transactions?.length) return;
    const headers = ['Date', 'Party', 'Wallet', 'Email', 'Type', 'Amount', 'Rate', 'Total (NPR)', 'Remark'];
    const rows = transactions.map(txn => [txn.txn_date, txn.parties?.party_name || '', txn.paypal_accounts?.paypal_name || '', txn.paypal_emails?.email || '', txn.txn_type, txn.amount, txn.rate, txn.total, txn.remark || '']);
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

      {/* Tabs for Transactions and Transfers */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          {/* Incoming/Outgoing Sub-Tabs */}
          <Tabs value={txnSubTab} onValueChange={(v) => setTxnSubTab(v as 'incoming' | 'outgoing')} className="mb-4">
            <TabsList>
              <TabsTrigger value="incoming">
                <ArrowDownLeft className="mr-2 h-4 w-4" />
                Incoming
              </TabsTrigger>
              <TabsTrigger value="outgoing">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Outgoing
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="form-field min-w-[200px] flex-1"><Label>Search</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search party, email, remark..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div></div>
                <div className="form-field min-w-[180px]"><Label>Wallet</Label><Select value={walletFilter} onValueChange={setWalletFilter}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="ALL">All Wallets</SelectItem>{walletAccounts?.map((account) => (<SelectItem key={account.id} value={account.id}>{account.paypal_name}{(account as any).tag && <span className="ml-1.5 text-[10px] font-medium text-pink-600 dark:text-pink-400">{(account as any).tag}</span>}</SelectItem>))}</SelectContent></Select></div>
                <div className="form-field min-w-[180px]"><Label>Party</Label><Select value={partyFilter} onValueChange={setPartyFilter}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent className="bg-popover"><SelectItem value="ALL">All Parties</SelectItem>{parties?.map((party) => (<SelectItem key={party.id} value={party.id}>{party.party_name}</SelectItem>))}</SelectContent></Select></div>
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
                <Button variant="outline" onClick={exportCSV} disabled={!transactions?.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
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
                      <TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Wallet</TableHead><TableHead>Email</TableHead><TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">NPR Total</TableHead>
                      <TableHead>Remark</TableHead><TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? ([...Array(5)].map((_, i) => (<TableRow key={i}>{[...Array(10)].map((_, j) => (<TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>))}</TableRow>)))
                    : transactions?.length === 0 ? (<TableRow><TableCell colSpan={10}><EmptyState title="No transactions yet" description="Create your first transaction using the Bulk Transaction button" className="my-8" /></TableCell></TableRow>)
                    : transactions?.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(txn.txn_date)}</TableCell>
                        <TableCell className="font-medium">{txn.parties?.party_name}</TableCell>
                        <TableCell>{txn.paypal_accounts?.paypal_name}{(txn.paypal_accounts as any)?.tag && <span className="ml-1.5 text-[10px] font-medium text-pink-600 dark:text-pink-400">{(txn.paypal_accounts as any).tag}</span>}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{txn.paypal_emails?.email || '-'}</TableCell>
                        <TableCell><StatusBadge variant={txn.txn_type === 'INCOMING' ? 'incoming' : 'outgoing'}>{txn.txn_type === 'INCOMING' ? <><ArrowDownLeft className="mr-1 h-3 w-3" /> In</> : <><ArrowUpRight className="mr-1 h-3 w-3" /> Out</>}</StatusBadge></TableCell>
                        <TableCell className="text-right font-mono">{formatUSD(txn.amount)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{showSensitive ? txn.rate.toFixed(2) : MASK}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{showSensitive ? formatNumber(txn.total) : MASK}</TableCell>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="mt-6">
          {/* Transfers Table */}
          <Card>
            <CardContent className="pt-6">
              <div className="table-container max-h-[600px]">
                <Table>
                  <TableHeader className="table-sticky-header">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From Wallet</TableHead>
                      <TableHead>To Wallet</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Total Deducted</TableHead>
                      <TableHead>Remark</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfersLoading ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(8)].map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : transfers?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <EmptyState 
                            icon={<ArrowRightLeft className="h-6 w-6" />}
                            title="No transfers yet"
                            description="Create your first transfer to move funds between wallets"
                            action={
                              <Button onClick={() => setShowTransferModal(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                New Transfer
                              </Button>
                            }
                            className="my-8"
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      transfers?.map((transfer) => {
                        const fee = transfer.total - transfer.amount;
                        return (
                          <TableRow key={transfer.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(transfer.transfer_date)}</TableCell>
                            <TableCell className="font-medium">{transfer.from_wallet?.paypal_name || 'None'}</TableCell>
                            <TableCell className="font-medium">{transfer.to_wallet?.paypal_name || 'None'}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatUSD(transfer.amount)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {fee > 0 ? formatUSD(fee) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-destructive">
                              -{formatUSD(transfer.total)}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[150px] truncate">
                              {transfer.remark || '-'}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-popover">
                                  <DropdownMenuItem onClick={() => { if (!isAdmin) { notifyAdmin(); return; } setDeleteTransferId(transfer.id); }} className="text-destructive focus:text-destructive">
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
        </TabsContent>
      </Tabs>

      <BulkTransactionModal open={showBulkModal} onOpenChange={setShowBulkModal} />
      <TransferModal open={showTransferModal} onOpenChange={setShowTransferModal} />

      <Dialog open={!!editingTxn} onOpenChange={() => setEditingTxn(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>{editingTxn && (<div className="space-y-4"><div className="form-field"><Label>Date</Label><Input type="date" value={editingTxn.txn_date} onChange={(e) => setEditingTxn({...editingTxn, txn_date: e.target.value})} /></div><div className="form-field"><Label>Amount</Label><Input type="text" inputMode="decimal" value={editingTxn.amount} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setEditingTxn({...editingTxn, amount: parseFloat(val) || 0}); }} className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div><div className="form-field"><Label>Rate</Label><Input type="text" inputMode="decimal" value={editingTxn.rate} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setEditingTxn({...editingTxn, rate: parseFloat(val) || 0}); }} className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div><div className="form-field"><Label>NPR Total</Label><Input type="text" value={formatNumber(editingTxn.amount * editingTxn.rate)} readOnly className="bg-muted" /></div><div className="form-field"><Label>Remark</Label><Input value={editingTxn.remark || ''} onChange={(e) => setEditingTxn({...editingTxn, remark: e.target.value})} /></div></div>)}<DialogFooter><Button variant="outline" onClick={() => setEditingTxn(null)}>Cancel</Button><Button onClick={handleUpdateSubmit} disabled={updateTransaction.isPending}>Save</Button></DialogFooter></DialogContent></Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete Transaction" description="Are you sure you want to delete this transaction? This action cannot be undone." confirmLabel="Delete" onConfirm={handleDelete} variant="destructive" />
      <ConfirmDialog open={!!deleteTransferId} onOpenChange={() => setDeleteTransferId(null)} title="Delete Transfer" description="Are you sure you want to delete this transfer? This will affect wallet balance calculations." confirmLabel="Delete" onConfirm={handleDeleteTransfer} variant="destructive" />
    </AppLayout>
  );
}
