import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';

export interface NprTransfer {
  id: string;
  from_account_id: string | null;
  from_account_name: string;
  to_account_id: string | null;
  to_account_name: string;
  amount_npr: number;
  transfer_date: string;
  remark: string | null;
}

export type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

interface UseNprTransfersParams {
  datePreset: DatePreset;
  customDateFrom?: string;
  customDateTo?: string;
  nepaliAccountId?: string;
  remarkSearch?: string;
}

function getDateRange(preset: DatePreset, customFrom?: string, customTo?: string) {
  const now = new Date();
  
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    case 'custom':
      return {
        from: customFrom ? parseISO(customFrom) : startOfDay(subDays(now, 29)),
        to: customTo ? endOfDay(parseISO(customTo)) : endOfDay(now),
      };
    default:
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
  }
}

export function useNprTransfers(params: UseNprTransfersParams) {
  const { datePreset, customDateFrom, customDateTo, nepaliAccountId, remarkSearch } = params;

  return useQuery({
    queryKey: ['npr-transfers', datePreset, customDateFrom, customDateTo, nepaliAccountId, remarkSearch],
    queryFn: async () => {
      const { from, to } = getDateRange(datePreset, customDateFrom, customDateTo);
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      // Fetch all TRANSFER_OUT entries (represents the "from" side of transfers)
      let outQuery = supabase
        .from('nepali_account_ledger')
        .select('id, nepali_account_id, entry_date, amount_npr, remark, source_id, created_at')
        .eq('entry_type', 'TRANSFER_OUT')
        .eq('source_type', 'TRANSFER')
        .gte('entry_date', fromStr)
        .lte('entry_date', toStr)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (remarkSearch) {
        outQuery = outQuery.ilike('remark', `%${remarkSearch}%`);
      }

      // Fetch all TRANSFER_IN entries
      let inQuery = supabase
        .from('nepali_account_ledger')
        .select('id, nepali_account_id, entry_date, amount_npr, remark, source_id, created_at')
        .eq('entry_type', 'TRANSFER_IN')
        .eq('source_type', 'TRANSFER')
        .gte('entry_date', fromStr)
        .lte('entry_date', toStr)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (remarkSearch) {
        inQuery = inQuery.ilike('remark', `%${remarkSearch}%`);
      }

      const [{ data: transferOutEntries, error: outError }, { data: transferInEntries, error: inError }] = await Promise.all([outQuery, inQuery]);
      if (outError) throw outError;
      if (inError) throw inError;

      // Fetch account names
      const { data: accounts, error: accountsError } = await supabase
        .from('nepali_accounts')
        .select('id, name');

      if (accountsError) throw accountsError;

      const accountMap = new Map(accounts?.map(a => [a.id, a.name]) || []);

      // Group by source_id for paired matching
      const transfers: NprTransfer[] = [];
      const usedSourceIds = new Set<string>();

      // Build source_id maps
      const outBySource = new Map<string, typeof transferOutEntries extends (infer T)[] | null ? T : never>();
      const inBySource = new Map<string, typeof transferInEntries extends (infer T)[] | null ? T : never>();

      for (const entry of transferOutEntries || []) {
        if (entry.source_id) outBySource.set(entry.source_id, entry);
      }
      for (const entry of transferInEntries || []) {
        if (entry.source_id) inBySource.set(entry.source_id, entry);
      }

      // Paired transfers (both OUT and IN with same source_id)
      for (const [sourceId, outEntry] of outBySource) {
        const inEntry = inBySource.get(sourceId);
        if (inEntry) {
          transfers.push({
            id: outEntry.id,
            from_account_id: outEntry.nepali_account_id,
            from_account_name: accountMap.get(outEntry.nepali_account_id) || 'Unknown',
            to_account_id: inEntry.nepali_account_id,
            to_account_name: accountMap.get(inEntry.nepali_account_id) || 'Unknown',
            amount_npr: Number(outEntry.amount_npr),
            transfer_date: outEntry.entry_date,
            remark: outEntry.remark,
          });
          usedSourceIds.add(sourceId);
        }
      }

      // Unpaired TRANSFER_OUT (Account → None)
      for (const [sourceId, outEntry] of outBySource) {
        if (!usedSourceIds.has(sourceId)) {
          transfers.push({
            id: outEntry.id,
            from_account_id: outEntry.nepali_account_id,
            from_account_name: accountMap.get(outEntry.nepali_account_id) || 'Unknown',
            to_account_id: null,
            to_account_name: 'None',
            amount_npr: Number(outEntry.amount_npr),
            transfer_date: outEntry.entry_date,
            remark: outEntry.remark,
          });
        }
      }

      // Unpaired TRANSFER_IN (None → Account)
      for (const [sourceId, inEntry] of inBySource) {
        if (!usedSourceIds.has(sourceId)) {
          transfers.push({
            id: inEntry.id,
            from_account_id: null,
            from_account_name: 'None',
            to_account_id: inEntry.nepali_account_id,
            to_account_name: accountMap.get(inEntry.nepali_account_id) || 'Unknown',
            amount_npr: Number(inEntry.amount_npr),
            transfer_date: inEntry.entry_date,
            remark: inEntry.remark,
          });
        }
      }

      // Sort by date desc
      transfers.sort((a, b) => b.transfer_date.localeCompare(a.transfer_date));

      // Filter by account if specified
      if (nepaliAccountId && nepaliAccountId !== 'all') {
        return transfers.filter(t =>
          t.from_account_id === nepaliAccountId ||
          t.to_account_id === nepaliAccountId
        );
      }

      return transfers;
    },
  });
}
