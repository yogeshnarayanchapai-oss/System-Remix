import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDaybook } from '@/hooks/useDaybook';
import { formatNPR, formatNumber, formatUSD } from '@/lib/format';

interface DaybookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateFrom?: string;
  dateTo?: string;
}

function Direction({ value }: { value: 'INCOMING' | 'OUTGOING' }) {
  const isIncoming = value === 'INCOMING';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isIncoming ? 'text-success' : 'text-outgoing'}`}>
      {isIncoming ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
      {isIncoming ? 'Incoming' : 'Outgoing'}
    </span>
  );
}

export function DaybookModal({ open, onOpenChange, dateFrom, dateTo }: DaybookModalProps) {
  const [currency, setCurrency] = useState<'USD' | 'NPR'>('USD');
  const { data, isLoading, error } = useDaybook({ dateFrom, dateTo, enabled: open });

  const usdTotals = useMemo(() => (data?.usd || []).reduce(
    (totals, entry) => {
      totals.incoming += entry.direction === 'INCOMING' ? entry.amountUsd : 0;
      totals.outgoing += entry.direction === 'OUTGOING' ? entry.amountUsd : 0;
      return totals;
    },
    { incoming: 0, outgoing: 0 },
  ), [data?.usd]);

  const nprTotals = useMemo(() => (data?.npr || []).reduce(
    (totals, entry) => {
      totals.incoming += entry.direction === 'INCOMING' ? entry.amountNpr : 0;
      totals.outgoing += entry.direction === 'OUTGOING' ? entry.amountNpr : 0;
      return totals;
    },
    { incoming: 0, outgoing: 0 },
  ), [data?.npr]);

  const query = new URLSearchParams();
  if (dateFrom) query.set('dateFrom', dateFrom);
  if (dateTo) query.set('dateTo', dateTo);
  const queryString = query.toString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Daybook
          </DialogTitle>
          <DialogDescription>
            {dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'Today'}` : 'All recorded activity'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currency} onValueChange={(value) => setCurrency(value as 'USD' | 'NPR')} className="min-h-0">
          <TabsList>
            <TabsTrigger value="USD">USD Transactions</TabsTrigger>
            <TabsTrigger value="NPR">NPR Party Ledger</TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="space-y-3 py-4">
              {[...Array(5)].map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">Unable to load Daybook entries.</p>
          ) : (
            <>
              <TabsContent value="USD" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-success/10 p-3">
                    <p className="text-xs text-muted-foreground">Incoming USD</p>
                    <p className="text-lg font-semibold text-success">{formatUSD(usdTotals.incoming)}</p>
                  </div>
                  <div className="rounded-lg bg-outgoing/10 p-3">
                    <p className="text-xs text-muted-foreground">Outgoing USD</p>
                    <p className="text-lg font-semibold text-outgoing">{formatUSD(usdTotals.outgoing)}</p>
                  </div>
                </div>
                <div className="max-h-[45vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="table-sticky-header">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead>Wallet</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">NPR Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.usd.length ? data.usd.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.date}</TableCell>
                          <TableCell className="font-medium">{entry.partyName}</TableCell>
                          <TableCell>{entry.walletName}</TableCell>
                          <TableCell><Direction value={entry.direction} /></TableCell>
                          <TableCell className="text-right">{formatUSD(entry.amountUsd)}</TableCell>
                          <TableCell className="text-right">{formatNumber(entry.rate)}</TableCell>
                          <TableCell className="text-right">{formatNPR(entry.totalNpr)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No USD transactions for this period.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/transactions${queryString ? `?${queryString}` : ''}`} onClick={() => onOpenChange(false)}>
                      View More USD Transactions <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="NPR" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-success/10 p-3">
                    <p className="text-xs text-muted-foreground">Incoming NPR</p>
                    <p className="text-lg font-semibold text-success">{formatNPR(nprTotals.incoming)}</p>
                  </div>
                  <div className="rounded-lg bg-outgoing/10 p-3">
                    <p className="text-xs text-muted-foreground">Outgoing NPR</p>
                    <p className="text-lg font-semibold text-outgoing">{formatNPR(nprTotals.outgoing)}</p>
                  </div>
                </div>
                <div className="max-h-[45vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="table-sticky-header">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead className="text-right">Amount (NPR)</TableHead>
                        <TableHead>Remark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.npr.length ? data.npr.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.date}</TableCell>
                          <TableCell className="font-medium">{entry.partyName}</TableCell>
                          <TableCell><Direction value={entry.direction} /></TableCell>
                          <TableCell className="text-right">{formatNPR(entry.amountNpr)}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{entry.remark || '-'}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No NPR entries for this period.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/receivable-payable${queryString ? `?${queryString}` : ''}`} onClick={() => onOpenChange(false)}>
                      View More NPR Entries <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}