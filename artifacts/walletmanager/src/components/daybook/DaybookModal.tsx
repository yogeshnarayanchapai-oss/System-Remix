import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

type Currency = 'NPR' | 'USD';

export function DaybookModal({ open, onOpenChange, dateFrom, dateTo }: DaybookModalProps) {
  const [currency, setCurrency] = useState<Currency>('NPR');
  const { data, isLoading, error } = useDaybook({ dateFrom, dateTo, enabled: open });

  const summary = useMemo(() => {
    const totals = {
      receivedUsd: 0,
      receivedNpr: 0,
      paymentUsd: 0,
      paymentNpr: 0,
      partyIncomingNpr: 0,
      partyOutgoingNpr: 0,
    };

    data?.usd.forEach((entry) => {
      if (entry.direction === 'INCOMING') {
        totals.receivedUsd += entry.amountUsd;
        totals.receivedNpr += entry.totalNpr;
      } else {
        totals.paymentUsd += entry.amountUsd;
        totals.paymentNpr += entry.totalNpr;
      }
    });

    data?.npr.forEach((entry) => {
      if (entry.direction === 'INCOMING') {
        totals.partyIncomingNpr += entry.amountNpr;
      } else {
        totals.partyOutgoingNpr += entry.amountNpr;
      }
    });

    const averageRate = totals.receivedUsd > 0 ? totals.receivedNpr / totals.receivedUsd : 0;
    const received = currency === 'NPR' ? totals.receivedNpr : totals.receivedUsd;
    const payment = currency === 'NPR' ? totals.partyOutgoingNpr : totals.paymentUsd;
    const netBalance = received - payment;
    const partyNetNpr = totals.partyOutgoingNpr - totals.partyIncomingNpr;
    const partyNet = currency === 'NPR' || averageRate === 0
      ? partyNetNpr
      : partyNetNpr / averageRate;

    return {
      ...totals,
      averageRate,
      received,
      payment,
      netBalance,
      partyNet,
    };
  }, [currency, data]);

  const query = new URLSearchParams();
  if (dateFrom) query.set('dateFrom', dateFrom);
  if (dateTo) query.set('dateTo', dateTo);
  const queryString = query.toString();
  const formatAmount = (amount: number) => currency === 'NPR' ? formatNPR(amount) : formatUSD(amount);
  const nextCurrency: Currency = currency === 'NPR' ? 'USD' : 'NPR';
  const partyBalanceLabel = summary.partyNet > 0 ? 'Receivable' : summary.partyNet < 0 ? 'Payable' : 'Settled';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5 text-primary" />
                Daybook
              </DialogTitle>
              <DialogDescription className="mt-1">
                {dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'Today'}` : 'All recorded activity'}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrency(nextCurrency)}
              title={`Switch to ${nextCurrency}`}
            >
              {currency}
              <ArrowLeftRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">Unable to load Daybook summary.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border-l-4 border-success bg-success/10 p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Received ({currency})</p>
                <p className="mt-1 text-2xl font-bold text-success">{formatAmount(summary.received)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currency === 'NPR' ? `${formatUSD(summary.receivedUsd)} received × average rate` : 'Incoming USD total'}
                </p>
              </div>
              <div className="rounded-lg border-l-4 border-outgoing bg-outgoing/10 p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Payment ({currency})</p>
                <p className="mt-1 text-2xl font-bold text-outgoing">{formatAmount(summary.payment)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currency === 'NPR' ? 'Outgoing party ledger total' : 'Outgoing USD transaction total'}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-2 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                <span>Daybook Summary</span>
                <span className="text-right">{currency}</span>
              </div>
              <div className="divide-y">
                <div className="grid grid-cols-2 px-4 py-3">
                  <span className="text-muted-foreground">Today average rate</span>
                  <span className="text-right font-semibold">{formatNumber(summary.averageRate)}</span>
                </div>
                <div className="grid grid-cols-2 bg-primary/10 px-4 py-3 text-lg font-bold">
                  <span>Today Net Balance</span>
                  <span className={`text-right ${summary.netBalance >= 0 ? 'text-success' : 'text-outgoing'}`}>
                    {formatAmount(summary.netBalance)}
                  </span>
                </div>
                <div className="grid grid-cols-2 px-4 py-3">
                  <span className="text-muted-foreground">Exact Receivable / Payable</span>
                  <span className={`text-right font-semibold ${summary.partyNet >= 0 ? 'text-success' : 'text-outgoing'}`}>
                    {formatAmount(Math.abs(summary.partyNet))} {partyBalanceLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-md bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Received entries</p>
                <p className="mt-1 font-semibold">{data?.usd.filter((entry) => entry.direction === 'INCOMING').length || 0}</p>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Payment entries</p>
                <p className="mt-1 font-semibold">{data?.npr.filter((entry) => entry.direction === 'OUTGOING').length || 0}</p>
              </div>
              <div className="rounded-md bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">Party ledger net (NPR)</p>
                <p className="mt-1 font-semibold">{formatNPR(Math.abs(summary.partyOutgoingNpr - summary.partyIncomingNpr))}</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/receivable-payable${queryString ? `?${queryString}` : ''}`} onClick={() => onOpenChange(false)}>
                  NPR Details <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/transactions${queryString ? `?${queryString}` : ''}`} onClick={() => onOpenChange(false)}>
                  USD Details <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}