import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, BookOpen, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useDaybook } from '@/hooks/useDaybook';

interface DaybookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Currency = 'NPR' | 'USD';

function formatWhole(value: number) {
  return Math.round(value).toLocaleString('en-US');
}

export function DaybookModal({ open, onOpenChange }: DaybookModalProps) {
  const [currency, setCurrency] = useState<Currency>('NPR');
  const [detailsMode, setDetailsMode] = useState<Currency | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const selectedDateLabel = format(selectedDateObject, 'dd-MMM-yyyy');

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
    const partyNet = currency === 'NPR' || averageRate === 0 ? partyNetNpr : partyNetNpr / averageRate;

    return { ...totals, averageRate, received, payment, netBalance, partyNet };
  }, [currency, data]);

  const partyBalanceLabel = summary.partyNet > 0 ? 'Receivable' : summary.partyNet < 0 ? 'Payable' : 'Settled';
  const nextCurrency: Currency = currency === 'NPR' ? 'USD' : 'NPR';
  const receivedCount = currency === 'NPR'
    ? data?.npr.filter((entry) => entry.direction === 'INCOMING').length || 0
    : data?.usd.filter((entry) => entry.direction === 'INCOMING').length || 0;
  const paymentCount = currency === 'NPR'
    ? data?.npr.filter((entry) => entry.direction === 'OUTGOING').length || 0
    : data?.usd.filter((entry) => entry.direction === 'OUTGOING').length || 0;
  const receivedCountLabel = currency === 'NPR' ? 'NPR Received' : 'USD Incoming';
  const paymentCountLabel = currency === 'NPR' ? 'NPR Payment' : 'USD Outgoing';
  const moveDate = (days: number) => {
    setSelectedDate(format(addDays(selectedDateObject, days), 'yyyy-MM-dd'));
    setDetailsMode(null);
  };
  const chooseDate = (date?: Date) => {
    if (!date) return;
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setDetailsMode(null);
  };

  const renderDetails = (mode: Currency) => {
    const isUsd = mode === 'USD';
    const entries = isUsd ? data?.usd || [] : data?.npr || [];

    return (
      <div className="min-h-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setDetailsMode(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Summary
          </Button>
          <span className="text-xs text-muted-foreground">{entries.length} entries</span>
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {entries.length === 0 ? (
            <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              No {mode} entries for {selectedDateLabel}.
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {isUsd ? entry.partyName : entry.partyName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isUsd ? entry.walletName : entry.remark || 'No remark'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold ${entry.direction === 'INCOMING' ? 'text-success' : 'text-outgoing'}`}>
                      {entry.direction === 'INCOMING' ? '+' : '-'} {formatWhole(isUsd ? entry.amountUsd : entry.amountNpr)}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.direction === 'INCOMING' ? 'Received' : 'Payment'}</p>
                  </div>
                </div>
                {isUsd && (
                  <div className="mt-2 flex gap-4 border-t pt-2 text-xs text-muted-foreground">
                    <span>Rate: {formatWhole(entry.rate)}</span>
                    <span>NPR total: {formatWhole(entry.totalNpr)}</span>
                    {entry.remark && <span className="truncate">{entry.remark}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-3xl overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-col gap-3 pr-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <BookOpen className="h-5 w-5 shrink-0 text-primary" />
                {detailsMode ? `${detailsMode} Details` : 'Daybook'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {detailsMode ? `Read-only entries for ${selectedDateLabel}` : `One-day report for ${selectedDateLabel}`}
              </DialogDescription>
            </div>
            <div className="flex w-full items-center gap-1 sm:w-auto sm:gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => moveDate(-1)} title="Previous day">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-0 flex-1 gap-2 sm:flex-none">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedDateLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDateObject}
                    onSelect={chooseDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => moveDate(1)} title="Next day">
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!detailsMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setCurrency(nextCurrency)}
                  title={`Switch to ${nextCurrency}`}
                >
                  {currency}<ArrowLeftRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">Unable to load Daybook data.</p>
        ) : detailsMode ? (
          renderDetails(detailsMode)
        ) : (
          <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1 sm:space-y-4">
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-2 bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground sm:px-4 sm:py-3">
                <span>Daybook Summary</span>
                <span className="text-right">{currency}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:p-2.5">
                <div className="rounded-md border-l-4 border-success bg-success/10 p-2">
                  <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Total Received ({currency})</p>
                  <p className="mt-1 text-base font-bold text-success sm:text-lg">{formatWhole(summary.received)}</p>
                  {currency === 'NPR' && (
                    <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">
                      {formatWhole(summary.receivedUsd)} received × average rate {formatWhole(summary.averageRate)}
                    </p>
                  )}
                </div>
                <div className="rounded-md border-l-4 border-outgoing bg-outgoing/10 p-2">
                  <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Total Payment ({currency})</p>
                  <p className="mt-1 text-base font-bold text-outgoing sm:text-lg">{formatWhole(summary.payment)}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-xs">
                    {currency === 'NPR' ? 'Outgoing party ledger total' : 'Outgoing USD transaction total'}
                  </p>
                </div>
                <div className="col-span-2 rounded-md border-l-4 border-primary bg-primary/10 p-2 sm:col-span-1">
                  <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">Transfers</p>
                  <p className="mt-1 text-base font-bold text-primary sm:text-lg">{data?.transferCount || 0}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">On this date</p>
                </div>
              </div>
              <div className="grid gap-2 border-t bg-muted/20 p-3 text-sm sm:grid-cols-2 sm:p-4">
                <div className="flex items-center justify-between gap-3 rounded-md bg-primary/10 px-3 py-2.5 font-bold">
                  <span>Net Balance</span>
                  <span className={summary.netBalance >= 0 ? 'text-success' : 'text-outgoing'}>
                    {formatWhole(summary.netBalance)}
                  </span>
                </div>
                {currency === 'NPR' && (
                  <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5">
                    <span className="text-muted-foreground">Exact Receivable / Payable</span>
                    <span className={`font-semibold ${summary.partyNet >= 0 ? 'text-success' : 'text-outgoing'}`}>
                      {formatWhole(Math.abs(summary.partyNet))} {partyBalanceLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-2 py-1">{receivedCountLabel}: <strong className="text-foreground">{receivedCount}</strong></span>
                <span className="rounded bg-muted px-2 py-1">{paymentCountLabel}: <strong className="text-foreground">{paymentCount}</strong></span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:flex">
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setDetailsMode('NPR')}>
                  NPR Details
                </Button>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setDetailsMode('USD')}>
                  USD Details
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}