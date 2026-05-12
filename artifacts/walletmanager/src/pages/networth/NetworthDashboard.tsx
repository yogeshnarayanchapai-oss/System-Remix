import { useMemo, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Target, Download, Banknote } from 'lucide-react';
import { useNetworthEntries, useNetworthSettings, useNetworthCategories } from '@/hooks/useNetworth';
import { usePaypalSummary } from '@/hooks/useDashboard';
import { useTotalNprBalance } from '@/hooks/useNepaliAccounts';
import { formatNprShort, formatNprFull, NETWORTH_GROUPS } from '@/lib/networthFormat';
import { format, subMonths, subYears, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

export default function NetworthDashboard() {
  const { data: entries = [] } = useNetworthEntries();
  const { data: settings } = useNetworthSettings();
  const { data: categories = [] } = useNetworthCategories();
  const { data: walletSummary = [] } = usePaypalSummary();
  const { totalBalance: totalNpr } = useTotalNprBalance();
  const usdRate = Number(settings?.usd_npr_rate) || 0;
  const totalUsd = walletSummary.reduce((s, w) => s + Number(w.balance || 0), 0);
  const handCashNpr = totalUsd * usdRate + Number(totalNpr || 0);
  const todayDate = new Date();
  const thisMonthFrom = format(startOfMonth(todayDate), 'yyyy-MM-dd');
  const thisMonthTo = format(endOfMonth(todayDate), 'yyyy-MM-dd');
  const [datePreset, setDatePreset] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [filterFrom, setFilterFrom] = useState(thisMonthFrom);
  const [filterTo, setFilterTo] = useState(thisMonthTo);
  const [filterGroup, setFilterGroup] = useState('ALL');

  const handleDatePreset = (val: 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM') => {
    setDatePreset(val);
    if (val === 'THIS_MONTH') {
      setFilterFrom(format(startOfMonth(todayDate), 'yyyy-MM-dd'));
      setFilterTo(format(endOfMonth(todayDate), 'yyyy-MM-dd'));
    } else if (val === 'LAST_MONTH') {
      const lm = subMonths(todayDate, 1);
      setFilterFrom(format(startOfMonth(lm), 'yyyy-MM-dd'));
      setFilterTo(format(endOfMonth(lm), 'yyyy-MM-dd'));
    }
  };
  const [filterType, setFilterType] = useState('ALL');
  const printRef = useRef<HTMLDivElement>(null);

  const categoryGroupById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.group_name);
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterFrom && e.entry_date < filterFrom) return false;
      if (filterTo && e.entry_date > filterTo) return false;
      if (filterType !== 'ALL' && e.type !== filterType) return false;
      if (filterGroup !== 'ALL') {
        const g = e.category_id ? categoryGroupById.get(e.category_id) : null;
        return g === filterGroup;
      }
      return true;
    });
  }, [entries, filterFrom, filterTo, filterType, filterGroup, categoryGroupById]);

  const totals = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    for (const e of entries) {
      if (e.type === 'ASSET') assets += Number(e.amount_npr);
      else liabilities += Number(e.amount_npr);
    }
    return { assets, liabilities, networth: handCashNpr + assets - liabilities };
  }, [entries, handCashNpr]);

  const netWorthAsOf = (cutoff: Date): number => {
    let v = 0;
    for (const e of entries) {
      if (parseISO(e.entry_date) <= cutoff) {
        v += e.type === 'ASSET' ? Number(e.amount_npr) : -Number(e.amount_npr);
      }
    }
    return v;
  };

  const now = new Date();
  const lastMonth = netWorthAsOf(subMonths(now, 1));
  const lastYear = netWorthAsOf(subYears(now, 1));
  const monthlyGrowth = totals.networth - lastMonth;
  const yearlyGrowth = totals.networth - lastYear;
  const yearlyGrowthPct = lastYear !== 0 ? (yearlyGrowth / Math.abs(lastYear)) * 100 : 0;

  const networthByYear = useMemo(() => {
    if (entries.length === 0) return [] as { year: string; value: number }[];
    const years = Array.from(
      new Set(entries.map((e) => parseISO(e.entry_date).getFullYear())),
    ).sort();
    const minYear = years[0];
    const maxYear = Math.max(years[years.length - 1], now.getFullYear());
    const result: { year: string; value: number }[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      const cutoff = new Date(y, 11, 31);
      result.push({ year: String(y), value: netWorthAsOf(cutoff) });
    }
    return result;
  }, [entries]);

  const monthlyData = useMemo(() => {
    const year = now.getFullYear();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const buckets = months.map((m) => ({ month: m, income: 0, expense: 0 }));
    for (const e of entries) {
      const d = parseISO(e.entry_date);
      if (d.getFullYear() !== year) continue;
      const idx = d.getMonth();
      if (e.type === 'ASSET') buckets[idx].income += Number(e.amount_npr);
      else buckets[idx].expense += Number(e.amount_npr);
    }
    return buckets;
  }, [entries]);

  const goalProgress = useMemo(() => {
    if (!settings || settings.goal_target_npr <= settings.goal_start_npr) return 0;
    const span = settings.goal_target_npr - settings.goal_start_npr;
    const done = totals.networth - settings.goal_start_npr;
    return Math.max(0, Math.min(100, (done / span) * 100));
  }, [settings, totals.networth]);

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const cat = e.category_name || 'Uncategorized';
      const sub = e.subcategory_name || '—';
      const key = `${cat} › ${sub}`;
      map.set(key, (map.get(key) || 0) + (e.type === 'ASSET' ? Number(e.amount_npr) : -Number(e.amount_npr)));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 10);
  }, [filtered]);

  const currentCash = useMemo(() => {
    return entries
      .filter((e) => e.type === 'ASSET' && /liquid|cash|bank/i.test(e.category_name))
      .reduce((s, e) => s + Number(e.amount_npr), 0);
  }, [entries]);

  const handlePdfExport = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Please allow pop-ups for PDF export'); return; }
    w.document.write(`
      <html><head><title>Net Worth Report — ${format(now, 'd MMM yyyy')}</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .muted { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
        .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
        th { background: #f9fafb; }
        svg { display: none; }
      </style></head>
      <body>
        <h1>Net Worth Report</h1>
        <div class="muted">Generated ${format(now, 'd MMM yyyy, HH:mm')}</div>
        <div class="grid">
          <div class="card"><div class="label">Net Worth</div><div class="value">${formatNprShort(totals.networth)}</div></div>
          <div class="card"><div class="label">Total Assets</div><div class="value">${formatNprShort(totals.assets)}</div></div>
          <div class="card"><div class="label">Total Liabilities</div><div class="value">${formatNprShort(totals.liabilities)}</div></div>
          <div class="card"><div class="label">Goal Progress</div><div class="value">${goalProgress.toFixed(1)}%</div></div>
        </div>
        <h2>Top Categories</h2>
        <table>
          <thead><tr><th>Category</th><th>Net Value (NPR)</th></tr></thead>
          <tbody>
            ${breakdown.map((b) => `<tr><td>${b.name}</td><td>${formatNprFull(b.value)}</td></tr>`).join('')}
          </tbody>
        </table>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Net Worth Dashboard"
        description={`As of ${format(now, 'EEEE, d MMMM yyyy')}`}
        
      />

      <div ref={printRef}>
        {(() => {
          return (
            <Card className="mb-4 border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/20 p-3 text-primary">
                    <Wallet className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Net Worth</p>
                    <p className="text-4xl font-bold text-primary">{formatNprShort(totals.networth)}</p>
                    <p className="text-xs text-muted-foreground">{formatNprFull(totals.networth)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right text-xs sm:gap-6">
                  <div>
                    <p className="text-muted-foreground">Hand Cash</p>
                    <p className="font-mono text-sm font-semibold">{formatNprShort(handCashNpr)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assets</p>
                    <p className="font-mono text-sm font-semibold text-emerald-600">{formatNprShort(totals.assets)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Liabilities</p>
                    <p className="font-mono text-sm font-semibold text-red-600">{formatNprShort(totals.liabilities)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Hand Cash</p>
                <Banknote className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatNprShort(handCashNpr)}</p>
              <p className="text-[11px] text-muted-foreground">Wallet + NPR Cash</p>
            </CardContent>
          </Card>
          <SummaryCard
            label="Since Last Month"
            icon={monthlyGrowth >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            value={formatNprShort(monthlyGrowth)} sub={`${monthlyGrowth >= 0 ? '+' : ''}${formatNprFull(monthlyGrowth)}`}
            tone={monthlyGrowth >= 0 ? 'positive' : 'negative'}
          />
          <SummaryCard
            label="Since Last Year"
            icon={yearlyGrowth >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            value={formatNprShort(yearlyGrowth)} sub={`${yearlyGrowth >= 0 ? '+' : ''}${formatNprFull(yearlyGrowth)}`}
            tone={yearlyGrowth >= 0 ? 'positive' : 'negative'}
          />
          <SummaryCard
            label="Yearly Growth %" icon={<TrendingUp className="h-5 w-5" />}
            value={`${yearlyGrowthPct.toFixed(1)}%`} sub="vs same time last year"
            tone={yearlyGrowthPct >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />{settings?.goal_label || 'Goal'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="text-lg font-semibold">{formatNprShort(settings?.goal_start_npr || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Progress</p>
                  <p className="text-3xl font-bold text-primary">{goalProgress.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="text-lg font-semibold">{formatNprShort(settings?.goal_target_npr || 0)}</p>
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Hand Cash vs Assets</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Hand Cash</p>
                  <p className="text-2xl font-bold">{formatNprShort(handCashNpr)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Assets</p>
                  <p className="text-lg font-semibold">{formatNprShort(totals.assets)}</p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${totals.assets > 0 ? (handCashNpr / totals.assets) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Net Worth Growth</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={networthByYear}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={formatNprShort} width={80} />
                  <Tooltip formatter={(v: number) => formatNprFull(v)} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Monthly Assets vs Liabilities Added ({now.getFullYear()})</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={formatNprShort} width={80} />
                  <Tooltip formatter={(v: number) => formatNprFull(v)} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" name="Assets" />
                  <Bar dataKey="expense" fill="#ef4444" name="Liabilities" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Top Subcategories</CardTitle></CardHeader>
          <CardContent>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data — add entries to see breakdown.</p>
            ) : (
              <div className="space-y-2">
                {breakdown.map((b) => {
                  const max = Math.max(...breakdown.map((x) => Math.abs(x.value)));
                  const pct = max > 0 ? (Math.abs(b.value) / max) * 100 : 0;
                  return (
                    <div key={b.name}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{b.name}</span>
                        <span className={`font-mono ${b.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatNprShort(b.value)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${b.value >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  label, value, sub, icon, tone,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; tone: 'primary' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-600' :
    tone === 'negative' ? 'text-red-600' : 'text-primary';
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className={toneClass}>{icon}</div>
        </div>
        <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}
