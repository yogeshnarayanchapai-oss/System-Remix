import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Wallet, TrendingUp, Calendar, CreditCard, ChevronRight, Mail, Users, Scale, Eye, ArrowUpDown, Layers, ArrowRightLeft, Check, MailX, DollarSign, TrendingDown, Banknote, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useDashboardStats, usePaypalSummary, useEmailPerformance, usePartySummary, useEmailsWithNoActivity, useWalletPeriodStats } from '@/hooks/useDashboard';
import { useProfitMetrics, useTotalWalletBalance, getDateRange, DateFilterType, DateFilter } from '@/hooks/useProfitMetrics';
import { useSettleAllParty } from '@/hooks/usePartyTransactions';
import { useTotalNprBalance } from '@/hooks/useNepaliAccounts';
import { useUserRole } from '@/hooks/useUserRole';

import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatUSD, formatNPR, formatNumber } from '@/lib/format';
import { BulkTransactionModal } from '@/components/transactions/BulkTransactionModal';
import { TransferModal } from '@/components/transfers/TransferModal';
import { PartyLedgerModal } from '@/components/party/PartyLedgerModal';
import { NepaliAccountSelect } from '@/components/nepali-accounts/NepaliAccountSelect';
import { DaybookModal } from '@/components/daybook/DaybookModal';
import { PartySummary } from '@/lib/types';

type SortBy = 'recent' | 'total' | 'unsettled';

export default function Dashboard() {
  
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDaybook, setShowDaybook] = useState(false);
  const [viewLedger, setViewLedger] = useState<PartySummary | null>(null);
  const [settlingParty, setSettlingParty] = useState<PartySummary | null>(null);
  const [settleNepaliAccountId, setSettleNepaliAccountId] = useState<string | null>(null);
  
  // Date filter state
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('this_month');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  
  const { isAdmin, isEditor } = useUserRole();
  const { isVisible: showSensitive, MASK } = useSensitiveDataVisibility();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: walletSummary, isLoading: walletLoading } = usePaypalSummary();
  const { data: partySummary, isLoading: partyLoading } = usePartySummary();
  const settleAll = useSettleAllParty();
  const { totalBalance: totalNprBalance, isLoading: nprBalanceLoading } = useTotalNprBalance();
  
  // Get date filter
  const dateFilter: DateFilter = getDateRange(
    dateFilterType,
    customStartDate ? format(customStartDate, 'yyyy-MM-dd') : undefined,
    customEndDate ? format(customEndDate, 'yyyy-MM-dd') : undefined
  );
  
  // Profit metrics with date filter
  const { data: profitMetrics, isLoading: profitLoading } = useProfitMetrics(dateFilter);
  
  // Total wallet balance
  const { data: walletBalance, isLoading: walletBalanceLoading } = useTotalWalletBalance();
  const { data: walletPeriodStats } = useWalletPeriodStats(dateFilter.startDate, dateFilter.endDate);

  // Party summary uses NPR for receivable/payable - default sort by most recent activity
  const filteredPartySummary = partySummary?.filter(p => !hideZeroBalance || (p.receivable > 0 || p.payable > 0))?.sort((a, b) => {
    if (sortBy === 'recent') {
      // Sort by latest entry date (most recent first)
      const dateA = a.latestEntryDate || '';
      const dateB = b.latestEntryDate || '';
      return dateB.localeCompare(dateA);
    } else if (sortBy === 'total') {
      return (b.receivable + b.payable) - (a.receivable + a.payable);
    } else {
      return b.unsettled_count - a.unsettled_count;
    }
  });
  const partyTotals = partySummary?.reduce((acc, p) => { acc.receivable += p.receivable; acc.payable += p.payable; return acc; }, { receivable: 0, payable: 0 }) || { receivable: 0, payable: 0 };

  const handleSettleAll = async () => {
    if (!settlingParty) return;
    
    // Determine what type of settlement is needed
    const settleType = settlingParty.receivable > settlingParty.payable ? 'INCOMING' : 'OUTGOING';
    const amountNpr = Math.abs(settlingParty.net);
    
    await settleAll.mutateAsync({
      partyId: settlingParty.id,
      settleType,
      amountNpr,
      nepaliAccountId: settleNepaliAccountId,
    });
    
    setSettlingParty(null);
    setSettleNepaliAccountId(null);
  };

  const getDateFilterLabel = () => {
    switch (dateFilterType) {
      case 'today':
        return 'Today';
      case 'this_month':
        return 'This Month';
      case 'last_month':
        return 'Last Month';
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d, yyyy')}`;
        }
        return 'Custom';
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Overview of all wallet accounts and transactions"
        actions={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          {isAdmin && (
            <Button variant="outline" size="sm" className="min-w-0" onClick={() => setShowDaybook(true)}>
              <BookOpen className="mr-2 h-4 w-4" />Daybook
            </Button>
          )}
          <Button variant="outline" size="sm" className="min-w-0" onClick={() => setShowTransferModal(true)}><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer</Button>
          <Button size="sm" className="min-w-0" onClick={() => setShowBulkModal(true)}><Layers className="mr-2 h-4 w-4" />Bulk Transaction</Button>
        </div>}
      />

      {/* Party Receivable/Payable Summary - NPR values - Visible to ALL */}
      <Card className="mb-8">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-muted-foreground" /><div><CardTitle className="text-base">Party Receivable / Payable (NPR)</CardTitle><p className="text-sm text-muted-foreground">Party ledger summary</p></div></div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <Switch id="hide-zero" checked={hideZeroBalance} onCheckedChange={setHideZeroBalance} />
              <Label htmlFor="hide-zero" className="text-xs font-normal leading-tight sm:text-sm">Hide zero balance</Label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 flex-1 px-2 text-xs sm:flex-none sm:px-3 sm:text-sm"
              onClick={() => setSortBy(sortBy === 'recent' ? 'total' : sortBy === 'total' ? 'unsettled' : 'recent')}
            >
              <ArrowUpDown className="mr-1 h-4 w-4 shrink-0" />Sort by {sortBy === 'recent' ? 'Total' : sortBy === 'total' ? 'Entries' : 'Recent'}
            </Button>
            <Link to="/receivable-payable" className="min-w-0 flex-1 sm:flex-none">
              <Button variant="outline" size="sm" className="w-full px-2 text-xs sm:w-auto sm:px-3 sm:text-sm">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-success/10 p-3 text-center"><p className="text-xs text-muted-foreground">Total Receivable (लिनुपर्ने)</p><p className="text-xl font-bold text-success">{formatNPR(partyTotals.receivable)}</p></div>
            <div className="rounded-lg bg-payable/10 p-3 text-center"><p className="text-xs text-muted-foreground">Total Payable (दिनुपर्ने)</p><p className="text-xl font-bold text-payable">{formatNPR(partyTotals.payable)}</p></div>
            <div className="rounded-lg bg-primary/10 p-3 text-center"><p className="text-xs text-muted-foreground">Net Position</p><p className="text-xl font-bold text-primary">{formatNPR(partyTotals.receivable - partyTotals.payable)}</p></div>
          </div>
          <div className="table-container max-h-[300px]">
            <Table><TableHeader className="table-sticky-header"><TableRow><TableHead>Party Name</TableHead><TableHead className="text-right">Receivable (NPR)</TableHead><TableHead className="text-right">Payable (NPR)</TableHead><TableHead className="text-center">Entries</TableHead><TableHead>Status</TableHead><TableHead className="w-[120px]">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{partyLoading ? [...Array(3)].map((_, i) => (<TableRow key={i}>{[...Array(6)].map((_, j) => (<TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>))}</TableRow>)) : filteredPartySummary?.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{hideZeroBalance ? 'No parties with outstanding balances' : 'No party data yet'}</TableCell></TableRow>) : filteredPartySummary?.slice(0, 10).map((party) => (<TableRow key={party.id}><TableCell className="font-medium">{party.party_name}</TableCell><TableCell className="text-right currency-positive">{formatNPR(party.receivable)}</TableCell><TableCell className="text-right currency-negative">{formatNPR(party.payable)}</TableCell><TableCell className="text-center"><span className="text-muted-foreground">{party.unsettled_count}</span></TableCell><TableCell><StatusBadge variant={party.status === 'RECEIVABLE' ? 'receivable' : party.status === 'PAYABLE' ? 'payable' : 'settled'}>{party.status === 'RECEIVABLE' ? 'लिनुपर्ने' : party.status === 'PAYABLE' ? 'दिनुपर्ने' : 'सेटल भयो'}</StatusBadge></TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => setViewLedger(party)} title="View Ledger"><Eye className="h-4 w-4" /></Button>{(party.receivable > 0 || party.payable > 0) && (<Button variant="ghost" size="icon" onClick={() => setSettlingParty(party)} title="Settle All"><Check className="h-4 w-4 text-success" /></Button>)}</div></TableCell></TableRow>))}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Date Filter and Metrics */}
      <>
          {/* Date Filter Controls - Right aligned, smaller */}
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Filter:</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant={dateFilterType === 'today' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDateFilterType('today')}
              >
                Today
              </Button>
              <Button
                variant={dateFilterType === 'this_month' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDateFilterType('this_month')}
              >
                This Month
              </Button>
              <Button
                variant={dateFilterType === 'last_month' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDateFilterType('last_month')}
              >
                Last Month
              </Button>
              <Button
                variant={dateFilterType === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDateFilterType('custom')}
              >
                Custom
              </Button>
            </div>
            
            {/* From-To Date Pickers - Shown when Custom is selected */}
            {dateFilterType === 'custom' && (
              <div className="flex items-center gap-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 min-w-[100px] justify-start px-2 text-xs">
                      <Calendar className="mr-1.5 h-3 w-3" />
                      {customStartDate ? format(customStartDate, 'MMM d') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 min-w-[100px] justify-start px-2 text-xs">
                      <Calendar className="mr-1.5 h-3 w-3" />
                      {customEndDate ? format(customEndDate, 'MMM d') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Metrics Cards - Filtered by Date */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {profitLoading || walletBalanceLoading || nprBalanceLoading ? (
              [...Array(5)].map((_, i) => (<Skeleton key={i} className="h-32 rounded-xl" />))
            ) : (
              <>
                <StatCard 
                  title="Total Wallet Balance" 
                  value={showSensitive ? Math.round(walletBalance?.totalBalanceUsd || 0).toLocaleString() : MASK} 
                   subtitle={`${walletBalance?.walletCount || 0} wallets · Active: ${walletBalance?.activeWalletCount || 0} · Inactive: ${walletBalance?.inactiveWalletCount || 0}`}
                  icon={<Wallet className="h-5 w-5 text-primary" />} 
                  variant="primary" 
                />
                {isAdmin && (
                  <StatCard 
                    title="Total NPR Balance" 
                    value={showSensitive ? `NPR ${Math.round(totalNprBalance).toLocaleString()}` : MASK} 
                    subtitle="All Nepali Accounts"
                    icon={<Banknote className="h-5 w-5 text-success" />} 
                    variant="default" 
                  />
                )}
                <StatCard 
                  title={`Profit (${getDateFilterLabel()})`}
                  value={showSensitive ? `NPR ${Math.round(profitMetrics?.profitNpr || 0).toLocaleString()}` : MASK} 
                  subtitle={showSensitive || isEditor ? (profitMetrics?.weightedAvgIncomingRate === 0 ? 'N/A - No incoming data' : `Avg Rate: ${profitMetrics?.weightedAvgOutgoingRate.toFixed(2)} - ${profitMetrics?.weightedAvgIncomingRate.toFixed(2)}`) : ''}
                  icon={<TrendingUp className="h-5 w-5 text-success" />} 
                  variant={profitMetrics?.profitNpr && profitMetrics.profitNpr > 0 ? 'default' : 'default'}
                />
                <StatCard 
                  title={`Received (${getDateFilterLabel()})`}
                  value={showSensitive ? Math.round(profitMetrics?.receivedUsd || 0).toLocaleString() : MASK} 
                  icon={<ArrowDownLeft className="h-5 w-5 text-success" />} 
                />
                <StatCard 
                  title={`Sent (${getDateFilterLabel()})`}
                  value={showSensitive ? Math.round(profitMetrics?.sentUsd || 0).toLocaleString() : MASK} 
                  icon={<ArrowUpRight className="h-5 w-5 text-outgoing" />} 
                />
              </>
            )}
          </div>
        </>

      {/* Wallet Summary - USD - Active wallets with balance > 0, IN/OUT for selected date filter */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Wallet Accounts Summary ({getDateFilterLabel()})</CardTitle>
          </div>
          <Link to="/wallets"><Button variant="ghost" size="sm">Manage <ChevronRight className="ml-1 h-4 w-4" /></Button></Link>
        </CardHeader>
        <CardContent>
          <div className="table-container">
            <Table>
              <TableHeader className="table-sticky-header">
                <TableRow>
                  <TableHead>Wallet Name</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {walletLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>{[...Array(4)].map((_, j) => (<TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>))}</TableRow>
                  ))
                ) : (() => {
                  const filtered = walletSummary?.filter(a => a.is_active && a.balance > 0) || [];
                  if (filtered.length === 0) {
                    return (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No active wallets with balance.
                      </TableCell></TableRow>
                    );
                  }
                  return filtered.map((account) => {
                    const stats = walletPeriodStats?.[account.id];
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.paypal_name}</TableCell>
                        <TableCell className="text-right font-semibold">{showSensitive ? formatUSD(account.balance) : MASK}</TableCell>
                        <TableCell className="text-right currency-positive text-sm">
                          <div>{showSensitive ? formatUSD(stats?.in_total || 0) : MASK}</div>
                          {showSensitive && <div className="text-xs text-muted-foreground">{stats?.in_count || 0} txn</div>}
                        </TableCell>
                        <TableCell className="text-right currency-negative text-sm">
                          <div>{showSensitive ? formatUSD(stats?.out_total || 0) : MASK}</div>
                          {showSensitive && <div className="text-xs text-muted-foreground">{stats?.out_count || 0} txn</div>}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BulkTransactionModal open={showBulkModal} onOpenChange={setShowBulkModal} />
      {isAdmin && (
        <DaybookModal
          open={showDaybook}
          onOpenChange={setShowDaybook}
        />
      )}
      <TransferModal open={showTransferModal} onOpenChange={setShowTransferModal} />
      <PartyLedgerModal party={viewLedger} open={!!viewLedger} onOpenChange={() => setViewLedger(null)} />
      
      {/* Settle All Confirmation with Nepali Account Selection */}
      <Dialog open={!!settlingParty} onOpenChange={() => { setSettlingParty(null); setSettleNepaliAccountId(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Settle All - {settlingParty?.party_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This will clear the {settlingParty?.receivable && settlingParty.receivable > 0 ? 'receivable' : 'payable'} balance of {formatNPR(Math.abs(settlingParty?.net || 0))}.
            </p>
            <div className="space-y-2">
              <Label>Nepali Account (Optional)</Label>
              <NepaliAccountSelect
                value={settleNepaliAccountId}
                onChange={setSettleNepaliAccountId}
                placeholder="Select Nepali Account"
              />
              <p className="text-xs text-muted-foreground">
                {settleNepaliAccountId ? 'Cash will be added/deducted from this account' : 'None = Settlement record only, no cash movement'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSettlingParty(null); setSettleNepaliAccountId(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSettleAll} disabled={settleAll.isPending}>
              {settleAll.isPending ? 'Settling...' : 'Settle All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
