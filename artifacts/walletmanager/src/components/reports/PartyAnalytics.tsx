import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, ArrowUpDown, TrendingUp } from 'lucide-react';
import { startOfWeek, startOfMonth, subMonths, endOfMonth, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useSensitiveDataVisibility } from '@/hooks/useSensitiveDataVisibility';
import { formatUSD } from '@/lib/format';

type DatePreset = 'this_week' | 'this_month' | 'last_month' | 'all';
type SortMode = 'volume' | 'efficiency';

function getDateRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case 'this_week': {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      return { from: format(start, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
    }
    case 'this_month': {
      const start = startOfMonth(now);
      return { from: format(start, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') };
    }
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
    }
    case 'all':
    default:
      return {};
  }
}

function usePartyAnalytics(preset: DatePreset) {
  const { from, to } = getDateRange(preset);

  return useQuery({
    queryKey: ['party-analytics', preset, from, to],
    queryFn: async () => {
      // Fetch all transactions with pagination
      let allTxns: Array<{ party_id: string; amount: number; txn_type: string; txn_date: string }> = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        let query = supabase
          .from('transactions')
          .select('party_id, amount, txn_type, txn_date')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (from) query = query.gte('txn_date', from);
        if (to) query = query.lte('txn_date', to);

        const { data: batch, error } = await query;
        if (error) throw error;
        if (!batch || batch.length === 0) break;
        allTxns.push(...batch);
        if (batch.length < pageSize) break;
        page++;
      }

      // Fetch parties
      const { data: parties, error: pErr } = await supabase
        .from('parties')
        .select('id, party_name');
      if (pErr) throw pErr;

      const partyMap = new Map(parties?.map(p => [p.id, p.party_name]) || []);

      // Aggregate per party
      const agg = new Map<string, { count: number; volume: number }>();
      for (const txn of allTxns) {
        const existing = agg.get(txn.party_id) || { count: 0, volume: 0 };
        existing.count += 1;
        existing.volume += txn.amount;
        agg.set(txn.party_id, existing);
      }

      return Array.from(agg.entries()).map(([partyId, stats]) => ({
        partyId,
        partyName: partyMap.get(partyId) || 'Unknown',
        count: stats.count,
        volume: stats.volume,
        avgPerTxn: stats.count > 0 ? stats.volume / stats.count : 0,
      }));
    },
  });
}

export function PartyAnalytics() {
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [sortMode, setSortMode] = useState<SortMode>('volume');
  const { data, isLoading } = usePartyAnalytics(preset);
  const { isVisible: showSensitive, MASK } = useSensitiveDataVisibility();

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = [...data];
    if (sortMode === 'volume') {
      list.sort((a, b) => b.volume - a.volume);
    } else {
      // Efficiency: high volume per transaction (avg per txn desc)
      list.sort((a, b) => b.avgPerTxn - a.avgPerTxn);
    }
    return list;
  }, [data, sortMode]);

  const totalVolume = sorted.reduce((s, p) => s + p.volume, 0);
  const totalCount = sorted.reduce((s, p) => s + p.count, 0);

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">High Value Customer Analytics</CardTitle>
              <p className="text-sm text-muted-foreground">Party-wise transaction count & volume</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
              <TabsList>
                <TabsTrigger value="this_week">This Week</TabsTrigger>
                <TabsTrigger value="this_month">This Month</TabsTrigger>
                <TabsTrigger value="last_month">Last Month</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        {/* Sort toggle & summary */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <Tabs value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="volume" className="text-xs px-3 h-7 gap-1">
                  <ArrowUpDown className="h-3 w-3" />
                  Volume
                </TabsTrigger>
                <TabsTrigger value="efficiency" className="text-xs px-3 h-7 gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Avg / Txn
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex gap-4 ml-auto text-sm">
            <span className="text-muted-foreground">
              Parties: <strong className="text-foreground">{sorted.length}</strong>
            </span>
            <span className="text-muted-foreground">
              Txns: <strong className="text-foreground">{showSensitive ? totalCount : MASK}</strong>
            </span>
            <span className="text-muted-foreground">
              Vol: <strong className="text-foreground">{showSensitive ? formatUSD(totalVolume) : MASK}</strong>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="table-container max-h-[500px]">
          <Table>
            <TableHeader className="table-sticky-header">
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Txn Count</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Avg / Txn</TableHead>
                <TableHead className="text-center">Tag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No transactions in this period
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((party, i) => {
                  // Tag logic: high volume & low count = "High Value", high volume = "Top Volume"
                  const volumeShare = totalVolume > 0 ? party.volume / totalVolume : 0;
                  const countShare = totalCount > 0 ? party.count / totalCount : 0;
                  let tag: { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } | null = null;

                  if (volumeShare > 0.1 && party.avgPerTxn > (totalVolume / totalCount) * 1.5) {
                    tag = { label: 'High Value', variant: 'default' };
                  } else if (volumeShare > 0.1) {
                    tag = { label: 'Top Volume', variant: 'secondary' };
                  } else if (party.avgPerTxn > (totalVolume / totalCount) * 2) {
                    tag = { label: 'High Avg', variant: 'outline' };
                  }

                  return (
                    <TableRow key={party.partyId}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{party.partyName}</TableCell>
                      <TableCell className="text-right">{showSensitive ? party.count : MASK}</TableCell>
                      <TableCell className="text-right font-semibold currency-positive">
                        {showSensitive ? formatUSD(party.volume) : MASK}
                      </TableCell>
                      <TableCell className="text-right">
                        {showSensitive ? formatUSD(party.avgPerTxn) : MASK}
                      </TableCell>
                      <TableCell className="text-center">
                        {tag ? (
                          <Badge variant={tag.variant} className="text-xs">
                            {tag.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
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
  );
}
