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

export interface DaybookNprLedgerEntry {
  id: string;
  date: string;
  entryType: 'CREDIT' | 'DEBIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  amountNpr: number;
  walletName: string;
  remark: string | null;
}

export interface DaybookWalletTransfer {
  id: string;
  amountUsd: number;
  totalUsd: number;
  fromWalletName: string | null;
  toWalletName: string | null;
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

      let nprLedgerQuery = supabase
        .from('nepali_account_ledger')
        .select(`
          id,
          entry_date,
          entry_type,
          amount_npr,
          remark,
          nepali_accounts(name)
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
        .select(`
          id,
          amount,
          total,
          from_wallet_id,
          to_wallet_id,
          from_wallet:paypal_accounts!wallet_transfers_from_wallet_id_fkey(paypal_name),
          to_wallet:paypal_accounts!wallet_transfers_to_wallet_id_fkey(paypal_name)
        `);

      if (dateFrom) {
        transferQuery = transferQuery.gte('transfer_date', dateFrom);
        nprLedgerQuery = nprLedgerQuery.gte('entry_date', dateFrom);
      }
      if (dateTo) {
        transferQuery = transferQuery.lte('transfer_date', dateTo);
        nprLedgerQuery = nprLedgerQuery.lte('entry_date', dateTo);
      }

      const [
        { data: usdData, error: usdError },
        { data: nprData, error: nprError },
        { data: transferData, error: transferError },
        { data: nprLedgerData, error: nprLedgerError },
      ] = await Promise.all([
        usdQuery,
        nprQuery,
        transferQuery,
        nprLedgerQuery,
      ]);

      if (usdError) throw usdError;
      if (nprError) throw nprError;
      if (transferError) throw transferError;
      if (nprLedgerError) throw nprLedgerError;

      const allPartyTransactions: Array<{ entry_type: string; amount_npr: number }> = [];
      let partyPageFrom = 0;
      const partyPageSize = 1000;

      while (true) {
        const { data: partyBatch, error: partyBalanceError } = await supabase
          .from('party_transactions')
          .select('entry_type, amount_npr')
          .range(partyPageFrom, partyPageFrom + partyPageSize - 1);

        if (partyBalanceError) throw partyBalanceError;
        if (!partyBatch || partyBatch.length === 0) break;

        allPartyTransactions.push(...partyBatch);
        if (partyBatch.length < partyPageSize) break;
        partyPageFrom += partyPageSize;
      }

      const partyBalanceNpr = allPartyTransactions.reduce((balance, entry) => (
        entry.entry_type === 'OUTGOING'
          ? balance + (Number(entry.amount_npr) || 0)
          : balance - (Number(entry.amount_npr) || 0)
      ), 0);

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
        nprLedger: ((nprLedgerData || []) as any[]).map((entry): DaybookNprLedgerEntry => ({
          id: entry.id,
          date: entry.entry_date,
          entryType: entry.entry_type,
          amountNpr: Number(entry.amount_npr) || 0,
          walletName: entry.nepali_accounts?.name || 'Unknown NPR account',
          remark: entry.remark,
        })),
        walletTransfers: ((transferData || []) as any[]).map((transfer): DaybookWalletTransfer => ({
          id: transfer.id,
          amountUsd: Number(transfer.amount) || 0,
          totalUsd: Number(transfer.total) || 0,
          fromWalletName: transfer.from_wallet?.paypal_name || null,
          toWalletName: transfer.to_wallet?.paypal_name || null,
        })),
        transferCount: transferData?.length || 0,
        partyBalanceNpr,
      };
    },
  });
}