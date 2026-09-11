import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DaybookFilters {
  dateFrom?: string;
  dateTo?: string;
  enabled?: boolean;
}

export interface DaybookUsdEntry {
  id: string;
  date: string;
  direction: 'INCOMING' | 'OUTGOING';
  amountUsd: number;
  rate: number;
  totalNpr: number;
  partyName: string;
  walletName: string;
  remark: string | null;
}

export interface DaybookNprEntry {
  id: string;
  date: string;
  direction: 'INCOMING' | 'OUTGOING';
  amountNpr: number;
  partyName: string;
  remark: string | null;
}

export function useDaybook({ dateFrom, dateTo, enabled = true }: DaybookFilters = {}) {
  return useQuery({
    queryKey: ['daybook', dateFrom, dateTo],
    enabled,
    queryFn: async () => {
      let usdQuery = supabase
        .from('transactions')
        .select(`
          id,
          txn_date,
          txn_type,
          amount,
          rate,
          total,
          remark,
          parties(party_name),
          paypal_accounts(paypal_name)
        `)
        .order('txn_date', { ascending: false })
        .order('created_at', { ascending: false });

      let nprQuery = supabase
        .from('party_transactions')
        .select(`
          id,
          entry_date,
          entry_type,
          amount_npr,
          remark,
          parties!inner(party_name)
        `)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateFrom) {
        usdQuery = usdQuery.gte('txn_date', dateFrom);
        nprQuery = nprQuery.gte('entry_date', dateFrom);
      }
      if (dateTo) {
        usdQuery = usdQuery.lte('txn_date', dateTo);
        nprQuery = nprQuery.lte('entry_date', dateTo);
      }

      let transferQuery = supabase
        .from('wallet_transfers')
        .select('id', { count: 'exact', head: true });

      if (dateFrom) {
        transferQuery = transferQuery.gte('transfer_date', dateFrom);
      }
      if (dateTo) {
        transferQuery = transferQuery.lte('transfer_date', dateTo);
      }

      const [
        { data: usdData, error: usdError },
        { data: nprData, error: nprError },
        { count: transferCount, error: transferError },
      ] = await Promise.all([
        usdQuery,
        nprQuery,
        transferQuery,
      ]);

      if (usdError) throw usdError;
      if (nprError) throw nprError;
      if (transferError) throw transferError;

      return {
        usd: ((usdData || []) as any[]).map((entry): DaybookUsdEntry => ({
          id: entry.id,
          date: entry.txn_date,
          direction: entry.txn_type,
          amountUsd: Number(entry.amount) || 0,
          rate: Number(entry.rate) || 0,
          totalNpr: Number(entry.total) || 0,
          partyName: entry.parties?.party_name || 'Unknown party',
          walletName: entry.paypal_accounts?.paypal_name || 'Unknown wallet',
          remark: entry.remark,
        })),
        npr: ((nprData || []) as any[]).map((entry): DaybookNprEntry => ({
          id: entry.id,
          date: entry.entry_date,
          direction: entry.entry_type,
          amountNpr: Number(entry.amount_npr) || 0,
          partyName: entry.parties?.party_name || 'Unknown party',
          remark: entry.remark,
        })),
        transferCount: transferCount || 0,
      };
    },
  });
}