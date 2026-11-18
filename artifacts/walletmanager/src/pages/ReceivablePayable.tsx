import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Scale, 
  ArrowDownLeft, 
  ArrowUpRight,
  Eye,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePartyBalanceTotals, usePartySummary } from '@/hooks/useDashboard';
import { formatNPR } from '@/lib/format';
import { PartySummary } from '@/lib/types';
import { PartyLedgerModal } from '@/components/party/PartyLedgerModal';
import { TransactionsTab } from '@/components/receivable-payable/TransactionsTab';

export default function ReceivablePayable() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [viewLedger, setViewLedger] = useState<PartySummary | null>(null);
  const [activeTab, setActiveTab] = useState('summary');

  const { data: partySummary, isLoading, error: partyError } = usePartySummary();
  const { data: partyTotals, error: partyTotalsError } = usePartyBalanceTotals();

  // Filter parties
  const filteredParties = partySummary?.filter(p => {
    const matchesSearch = p.party_name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (hideZeroBalance) {
      return p.net !== 0;
    }
    return true;
  });

  // Global aggregate totals remain visible; party-level rows stay wallet-scoped.
  const totals = partyTotals || { receivable: 0, payable: 0 };

  // Nepali labels for this page only
  const labels = {
    receivable: 'लिनुपर्ने',      // Receivable
    payable: 'दिनुपर्ने',        // Payable
    settled: 'सेटल भयो',         // Settled
    unsettled: 'सेटल भएको छैन',  // Unsettled
  };

  const handleViewParty = (party: PartySummary) => {
    setViewLedger(party);
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Receivable / Payable" 
        description="Track what you owe and what's owed to you (NPR = USD × Rate)"
      />
      {(partyError || partyTotalsError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Some party balance data is unavailable</AlertTitle>
          <AlertDescription>
            {partyError && 'Party details and transactions require the account-access migration and only include assigned NPR wallets. '}
            {partyTotalsError && 'Global receivable/payable totals require the party-summary migration.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards - NPR */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={`${labels.receivable} (NPR)`}
          value={partyTotalsError ? 'Unavailable' : formatNPR(totals.receivable)}
          subtitle="Sum of OUTGOING (unsettled)"
          icon={<ArrowUpRight className="h-5 w-5 text-receivable" />}
        />
        <StatCard
          title={`${labels.payable} (NPR)`}
          value={partyTotalsError ? 'Unavailable' : formatNPR(totals.payable)}
          subtitle="Sum of INCOMING (unsettled)"
          icon={<ArrowDownLeft className="h-5 w-5 text-payable" />}
        />
        <StatCard
          title="Net Position (NPR)"
          value={partyTotalsError ? 'Unavailable' : formatNPR(totals.receivable - totals.payable)}
          subtitle={partyTotalsError ? 'Global total unavailable' : totals.receivable > totals.payable ? labels.receivable : totals.receivable < totals.payable ? labels.payable : 'Balanced'}
          variant="primary"
          icon={<Scale className="h-5 w-5 text-primary-foreground" />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary" className="gap-2">
            <Scale className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <FileText className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Input
                  placeholder="Search parties..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-md"
                />
                <Button
                  variant={hideZeroBalance ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setHideZeroBalance(!hideZeroBalance)}
                >
                  {hideZeroBalance ? 'Hide ≤0' : 'Show All'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Party Ledger Summary - NPR */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-5 w-5" />
                Party Ledger Summary - NPR ({labels.unsettled})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="table-container">
                <Table>
                  <TableHeader className="table-sticky-header">
                    <TableRow>
                      <TableHead>Party Name</TableHead>
                      <TableHead className="text-right">{labels.receivable} (NPR)</TableHead>
                      <TableHead className="text-right">{labels.payable} (NPR)</TableHead>
                      <TableHead className="text-right">Net (NPR)</TableHead>
                      <TableHead className="text-center">Entries</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(4)].map((_, i) => (
                        <TableRow key={i}>
                          {[...Array(7)].map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredParties?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <EmptyState 
                            icon={<Scale className="h-6 w-6" />}
                            title={search ? 'No parties found' : 'No transaction data'}
                            description={search ? 'Try a different search' : 'Create transactions to see receivable/payable data'}
                            className="my-8"
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredParties?.map((party) => (
                        <TableRow key={party.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {party.party_name}
                              {party.missing_rate_count && party.missing_rate_count > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-warning" title={`${party.missing_rate_count} transaction(s) missing rate`}>
                                  <AlertTriangle className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right currency-positive">
                            {formatNPR(party.receivable)}
                          </TableCell>
                          <TableCell className="text-right currency-negative">
                            {formatNPR(party.payable)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={party.net > 0 ? 'currency-positive' : party.net < 0 ? 'currency-negative' : ''}>
                              {party.net > 0 && '+'}
                              {formatNPR(party.net)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-muted-foreground">{party.unsettled_count}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge 
                              variant={
                                party.status === 'RECEIVABLE' ? 'receivable' : 
                                party.status === 'PAYABLE' ? 'payable' : 'settled'
                              }
                            >
                              {party.status === 'RECEIVABLE' ? labels.receivable : 
                               party.status === 'PAYABLE' ? labels.payable : labels.settled}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewLedger(party)}
                              title="View Ledger"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <TransactionsTab
            onViewParty={handleViewParty}
            initialDateFrom={searchParams.get('dateFrom') || undefined}
            initialDateTo={searchParams.get('dateTo') || undefined}
          />
        </TabsContent>

      </Tabs>

      {/* Party Ledger Modal */}
      {viewLedger && (
        <PartyLedgerModal
          party={{ id: viewLedger.id, party_name: viewLedger.party_name }}
          open={!!viewLedger}
          onOpenChange={() => setViewLedger(null)}
        />
      )}
    </AppLayout>
  );
}
