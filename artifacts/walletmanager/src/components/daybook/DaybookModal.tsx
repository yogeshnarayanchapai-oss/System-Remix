import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, CalendarDays, ExternalLink } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useDaybook } from '@/hooks/useDaybook';
import { formatNPR, formatUSD } from '@/lib/format';

interface DaybookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Currency = 'NPR' | 'USD';
type DatePreset = 'today' | 'yesterday' | 'custom';

function formatWhole(value: number) {
  return Math.round(value).toLocaleString('en-US');
}

export function DaybookModal({ open, onOpenChange }: DaybookModalProps) {
  const [currency, setCurrency] = useState<Currency>('NPR');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const today = new Date();
  const todayString = format(today, 'yyyy-MM-dd');
  const yesterdayString = format(subDays(today, 1), 'yyyy-MM-dd');
  const selectedDate = datePreset === 'today'
    ? todayString
    : datePreset === 'yesterday'
      ? yesterdayString
      : customDate
        ? format(customDate, 'yyyy-MM-dd')
        : todayString;
  const selectedDateLabel = format(new Date(`${selectedDate}T00:00:00`), 'dd-MMM-yyyy');
  const { data, isLoading, error } = useDaybook({
    dateFrom: selectedDate,
    dateTo: selectedDate,
    enabled: open,
  });

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
                One-day report for {selectedDateLabel}
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

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Date:</span>
          <Button
            variant={datePreset === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('today')}
          >
            Today
          </Button>
          <Button
            variant={datePreset === 'yesterday' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset('yesterday')}
          >
            Yesterday
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={datePreset === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                {datePreset === 'custom' && customDate ? format(customDate, 'dd-MMM-yyyy') : 'Custom date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={customDate}
                onSelect={(date) => {
                  if (date) {
                    setCustomDate(date);
                    setDatePreset('custom');
                  }
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

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
                <p className="mt-1 text-2xl font-bold text-success">{formatWhole(summary.received)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currency === 'NPR' ? `${formatWhole(summary.receivedUsd)} received × average rate` : 'Incoming USD total'}
                </p>
              </div>
              <div className="rounded-lg border-l-4 border-outgoing bg-outgoing/10 p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Payment ({currency})</p>
                <p className="mt-1 text-2xl font-bold text-outgoing">{formatWhole(summary.payment)}</p>
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
                  <span className="text-right font-semibold">{formatWhole(summary.averageRate)}</span>
                </div>
                <div className="grid grid-cols-2 bg-primary/10 px-4 py-3 text-lg font-bold">
                  <span>Today Net Balance</span>
                  <span className={`text-right ${summary.netBalance >= 0 ? 'text-success' : 'text-outgoing'}`}>
                    {formatWhole(summary.netBalance)}
                  </span>
                </div>
                <div className="grid grid-cols-2 px-4 py-3">
                  <span className="text-muted-foreground">Exact Receivable / Payable</span>
                  <span className={`text-right font-semibold ${summary.partyNet >= 0 ? 'text-success' : 'text-outgoing'}`}>
                    {formatWhole(Math.abs(summary.partyNet))} {partyBalanceLabel}
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
                  <p className="mt-1 font-semibold">{formatWhole(Math.abs(summary.partyOutgoingNpr - summary.partyIncomingNpr))}</p>
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