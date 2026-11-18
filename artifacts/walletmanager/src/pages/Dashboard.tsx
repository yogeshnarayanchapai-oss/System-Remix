import { useMemo, useState } from 'react';
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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { SelectOption } from '@/components/ui/SearchableSelect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useDashboardStats, useEmailPerformance, usePartyBalanceSummary, usePartyBalanceTotals, usePartySummary, useEmailsWithNoActivity } from '@/hooks/useDashboard';
import { useProfitMetrics, useTotalWalletBalance, getDateRange, DateFilterType, DateFilter } from '@/hooks/useProfitMetrics';
import { useSettleAllParty } from '@/hooks/usePartyTransactions';
import { useNepaliAccounts, useTotalNprBalance } from '@/hooks/useNepaliAccounts';
import { usePaypalAccounts } from '@/hooks/usePaypalAccounts';
import { useNprAccountBalanceHistory, useUsdAccountBalanceHistory } from '@/hooks/useAccountBalanceHistory';
import { useUserRole } from '@/hooks/useUserRole';

import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatUSD, formatNPR, formatCompactNPR, formatNumber } from '@/lib/format';
import { BulkTransactionModal } from '@/components/transactions/BulkTransactionModal';
import { TransferModal } from '@/components/transfers/TransferModal';
import { PartyLedgerModal } from '@/components/party/PartyLedgerModal';
import { NepaliAccountSelect } from '@/components/nepali-accounts/NepaliAccountSelect';
import { DaybookModal } from '@/components/daybook/DaybookModal';
import { PartySummary } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type SortBy = 'recent' | 'total' | 'unsettled';

export default function Dashboard() {
  
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [ledgerCurrency, setLedgerCurrency] = useState<'USD' | 'NPR'>('USD');
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState('');
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
  const { data: scopedPartySummary, error: partyScopeError } = usePartySummary();
  const { data: partySummary, isLoading: partyLoading, error: partySummaryError } = usePartyBalanceSummary();
  const { data: partyTotals, error: partyTotalsError } = usePartyBalanceTotals();
  const settleAll = useSettleAllParty();
  const { totalBalance: totalNprBalance, isLoading: nprBalanceLoading } = useTotalNprBalance();
  const { data: usdAccounts, isLoading: usdAccountsLoading } = usePaypalAccounts();
  const { data: nprAccounts, isLoading: nprAccountsLoading } = useNepaliAccounts(false);
  const {
    data: usdLedgerHistory,
    isLoading: usdLedgerLoading,
    isError: usdLedgerError,
  } = useUsdAccountBalanceHistory(ledgerCurrency === 'USD' && !!selectedLedgerAccountId);
  const {
    data: nprLedgerHistory,
    isLoading: nprLedgerLoading,
    isError: nprLedgerError,
  } = useNprAccountBalanceHistory(ledgerCurrency === 'NPR' && !!selectedLedgerAccountId);
  
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

  const ledgerAccountOptions = useMemo<SelectOption[]>(() => ledgerCurrency === 'USD'
    ? (usdAccounts || []).map((account) => ({
        value: account.id,
        label: account.paypal_name,
        sublabel: account.is_active ? 'Active wallet' : 'Inactive wallet',
      }))
    : (nprAccounts || []).map((account) => ({
        value: account.id,
        label: account.name,
        sublabel: account.status === 'ACTIVE' ? 'Active account' : 'Inactive account',
      })), [ledgerCurrency, usdAccounts, nprAccounts]);

  const selectedUsdLedgerSummary = ledgerCurrency === 'USD'
    ? usdLedgerHistory?.accountSummaries[selectedLedgerAccountId]
    : undefined;
  const selectedNprLedgerSummary = ledgerCurrency === 'NPR'
    ? nprLedgerHistory?.accountSummaries[selectedLedgerAccountId]
    : undefined;
  const selectedLedgerSummary = selectedUsdLedgerSummary || selectedNprLedgerSummary;
  const ledgerLoading = ledgerCurrency === 'USD' ? usdLedgerLoading : nprLedgerLoading;
  const ledgerError = ledgerCurrency === 'USD' ? usdLedgerError : nprLedgerError;
  const ledgerAccountLoading = ledgerCurrency === 'USD' ? usdAccountsLoading : nprAccountsLoading;
  const formatLedgerAmount = ledgerCurrency === 'USD' ? formatUSD : formatNPR;
  const formatVisibleLedgerAmount = (amount: number) => showSensitive ? formatLedgerAmount(amount) : MASK;
  const ledgerRows = ledgerCurrency === 'USD'
    ? selectedUsdLedgerSummary ? [
        { label: 'Incoming transactions', inAmount: selectedUsdLedgerSummary.transactionIncoming, inCount: selectedUsdLedgerSummary.transactionIncomingCount, outAmount: 0, outCount: 0 },
        { label: 'Outgoing transactions', inAmount: 0, inCount: 0, outAmount: selectedUsdLedgerSummary.transactionOutgoing, outCount: selectedUsdLedgerSummary.transactionOutgoingCount },
        { label: 'Transfers in', inAmount: selectedUsdLedgerSummary.transferIncoming, inCount: selectedUsdLedgerSummary.transferIncomingCount, outAmount: 0, outCount: 0 },
        { label: 'Transfers out (including fees)', inAmount: 0, inCount: 0, outAmount: selectedUsdLedgerSummary.transferOutgoing, outCount: selectedUsdLedgerSummary.transferOutgoingCount },
      ] : []
    : selectedNprLedgerSummary ? [
        { label: 'Credits', inAmount: selectedNprLedgerSummary.credits, inCount: selectedNprLedgerSummary.creditCount, outAmount: 0, outCount: 0 },
        { label: 'Debits', inAmount: 0, inCount: 0, outAmount: selectedNprLedgerSummary.debits, outCount: selectedNprLedgerSummary.debitCount },
        { label: 'Transfers in', inAmount: selectedNprLedgerSummary.transferIncoming, inCount: selectedNprLedgerSummary.transferIncomingCount, outAmount: 0, outCount: 0 },
        { label: 'Transfers out', inAmount: 0, inCount: 0, outAmount: selectedNprLedgerSummary.transferOutgoing, outCount: selectedNprLedgerSummary.transferOutgoingCount },
      ] : [];
  const totalLedgerInCount = ledgerRows.reduce((sum, row) => sum + row.inCount, 0);
  const totalLedgerOutCount = ledgerRows.reduce((sum, row) => sum + row.outCount, 0);

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
  const displayPartyTotals = partyTotals || { receivable: 0, payable: 0 };

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
          {(partyScopeError || partySummaryError || partyTotalsError) && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Some party balance data is unavailable</AlertTitle>
              <AlertDescription>
                {partyScopeError && 'Wallet-scoped transactions and settlement balances require the account-access migration. '}
                {(partySummaryError || partyTotalsError) && 'Global party balances require the party-summary migration.'}
              </AlertDescription>
            </Alert>
          )}
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-success/10 p-3 text-center"><p className="text-xs text-muted-foreground">Total Receivable (लिनुपर्ने)</p><p className="text-base font-bold text-success sm:text-lg" title={partyTotalsError ? 'Unavailable' : `${formatNPR(displayPartyTotals.receivable)} NPR`} aria-label={partyTotalsError ? 'Receivables unavailable' : `Total receivable ${formatNPR(displayPartyTotals.receivable)} NPR`}>{partyTotalsError ? 'Unavailable' : formatCompactNPR(displayPartyTotals.receivable)}</p></div>
            <div className="rounded-lg bg-payable/10 p-3 text-center"><p className="text-xs text-muted-foreground">Total Payable (दिनुपर्ने)</p><p className="text-base font-bold text-payable sm:text-lg" title={partyTotalsError ? 'Unavailable' : `${formatNPR(displayPartyTotals.payable)} NPR`} aria-label={partyTotalsError ? 'Payables unavailable' : `Total payable ${formatNPR(displayPartyTotals.payable)} NPR`}>{partyTotalsError ? 'Unavailable' : formatCompactNPR(displayPartyTotals.payable)}</p></div>
            <div className="rounded-lg bg-primary/10 p-3 text-center"><p className="text-xs text-muted-foreground">Net Position</p><p className="text-base font-bold text-primary sm:text-lg" title={partyTotalsError ? 'Unavailable' : `${formatNPR(displayPartyTotals.receivable - displayPartyTotals.payable)} NPR`} aria-label={partyTotalsError ? 'Net position unavailable' : `Net position ${formatNPR(displayPartyTotals.receivable - displayPartyTotals.payable)} NPR`}>{partyTotalsError ? 'Unavailable' : formatCompactNPR(displayPartyTotals.receivable - displayPartyTotals.payable)}</p></div>
          </div>
          <div className="table-container max-h-[300px]">
            <Table><TableHeader className="table-sticky-header"><TableRow><TableHead>Party Name</TableHead><TableHead className="text-right">Receivable (NPR)</TableHead><TableHead className="text-right">Payable (NPR)</TableHead><TableHead className="text-center">Entries</TableHead><TableHead>Status</TableHead><TableHead className="w-[120px]">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{partyLoading ? [...Array(3)].map((_, i) => (<TableRow key={i}>{[...Array(6)].map((_, j) => (<TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>))}</TableRow>)) : partySummaryError ? (<TableRow><TableCell colSpan={6} className="py-8 text-center text-destructive">Party balances unavailable</TableCell></TableRow>) : filteredPartySummary?.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{hideZeroBalance ? 'No parties with outstanding balances' : 'No party data yet'}</TableCell></TableRow>) : filteredPartySummary?.slice(0, 10).map((party) => (<TableRow key={party.id}><TableCell className="font-medium">{party.party_name}</TableCell><TableCell className="text-right currency-positive">{formatNPR(party.receivable)}</TableCell><TableCell className="text-right currency-negative">{formatNPR(party.payable)}</TableCell><TableCell className="text-center"><span className="text-muted-foreground">{party.unsettled_count}</span></TableCell><TableCell><StatusBadge variant={party.status === 'RECEIVABLE' ? 'receivable' : party.status === 'PAYABLE' ? 'payable' : 'settled'}>{party.status === 'RECEIVABLE' ? 'लिनुपर्ने' : party.status === 'PAYABLE' ? 'दिनुपर्ने' : 'सेटल भयो'}</StatusBadge></TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => setViewLedger(party)} title="View accessible ledger"><Eye className="h-4 w-4" /></Button>{scopedPartySummary?.some((scoped) => scoped.id === party.id && (scoped.receivable > 0 || scoped.payable > 0)) && (<Button variant="ghost" size="icon" onClick={() => { const scoped = scopedPartySummary.find((item) => item.id === party.id); if (scoped) setSettlingParty(scoped); }} title="Settle accessible balance"><Check className="h-4 w-4 text-success" /></Button>)}</div></TableCell></TableRow>))}</TableBody>
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
                   subtitle={`Active: ${showSensitive ? Math.round(walletBalance?.activeBalanceUsd || 0).toLocaleString() : MASK} · Inactive: ${showSensitive ? Math.round(walletBalance?.inactiveBalanceUsd || 0).toLocaleString() : MASK}`}
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

      {/* Searchable account ledger report - all-time balances and entry totals */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Account Ledger Report</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">All-time totals from the account's full ledger history</p>
            </div>
          </div>
          <Link to="/wallets">
            <Button variant="ghost" size="sm">Manage <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Account currency">
                <Button
                  type="button"
                  variant={ledgerCurrency === 'USD' ? 'default' : 'outline'}
                  onClick={() => {
                    setLedgerCurrency('USD');
                    setSelectedLedgerAccountId('');
                  }}
                >
                  USD
                </Button>
                <Button
                  type="button"
                  variant={ledgerCurrency === 'NPR' ? 'default' : 'outline'}
                  onClick={() => {
                    setLedgerCurrency('NPR');
                    setSelectedLedgerAccountId('');
                  }}
                >
                  NPR
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <SearchableSelect
                options={ledgerAccountOptions}
                value={selectedLedgerAccountId}
                onValueChange={setSelectedLedgerAccountId}
                placeholder={ledgerAccountLoading ? 'Loading accounts...' : 'Search and choose an account'}
                searchPlaceholder={`Search all ${ledgerCurrency} accounts...`}
                emptyText={`No ${ledgerCurrency} accounts found.`}
                disabled={ledgerAccountLoading || ledgerAccountOptions.length === 0}
              />
              <p className="text-xs text-muted-foreground">
                Search includes active and inactive accounts.
              </p>
            </div>
          </div>

          {ledgerError ? (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Could not load the complete account history. Try again later.
            </div>
          ) : !selectedLedgerAccountId ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {ledgerAccountLoading
                ? 'Loading accounts...'
                : ledgerAccountOptions.length === 0
                  ? `No ${ledgerCurrency} accounts available.`
                  : `Choose a ${ledgerCurrency} account to see its full-history report.`}
            </div>
          ) : ledgerLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <Skeleton className="mb-3 h-4 w-28" />
                  <Skeleton className="h-7 w-32" />
                </div>
              ))}
            </div>
          ) : selectedLedgerSummary ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Opening balance', amount: selectedLedgerSummary.openingBalance },
                  { label: 'Total in', amount: selectedLedgerSummary.totalIn },
                  { label: 'Total out', amount: selectedLedgerSummary.totalOut },
                  { label: 'Current balance', amount: selectedLedgerSummary.currentBalance },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-2 font-mono text-xl font-semibold">
                      {formatVisibleLedgerAmount(item.amount)} <span className="text-sm font-normal text-muted-foreground">{ledgerCurrency}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Totals by ledger type</h3>
                <div className="table-container">
                  <Table>
                    <TableHeader className="table-sticky-header">
                      <TableRow>
                        <TableHead>Ledger type</TableHead>
                        <TableHead className="text-right">In ({ledgerCurrency})</TableHead>
                        <TableHead className="text-right">Out ({ledgerCurrency})</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerRows.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="text-right font-mono text-sm currency-positive">
                            <div>{formatVisibleLedgerAmount(row.inAmount)}</div>
                            {showSensitive && <div className="text-xs text-muted-foreground">{row.inCount} {row.inCount === 1 ? 'entry' : 'entries'}</div>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm currency-negative">
                            <div>{formatVisibleLedgerAmount(row.outAmount)}</div>
                            {showSensitive && <div className="text-xs text-muted-foreground">{row.outCount} {row.outCount === 1 ? 'entry' : 'entries'}</div>}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right font-mono text-sm currency-positive">
                          <div>{formatVisibleLedgerAmount(selectedLedgerSummary.totalIn)}</div>
                          {showSensitive && <div className="text-xs text-muted-foreground">{totalLedgerInCount} {totalLedgerInCount === 1 ? 'entry' : 'entries'}</div>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm currency-negative">
                          <div>{formatVisibleLedgerAmount(selectedLedgerSummary.totalOut)}</div>
                          {showSensitive && <div className="text-xs text-muted-foreground">{totalLedgerOutCount} {totalLedgerOutCount === 1 ? 'entry' : 'entries'}</div>}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No account history summary is available for this account.
            </div>
          )}
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
