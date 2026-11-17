import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const PAGE_SIZE = 1000;

export const USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY = ['usd-account-balance-history', 'ledger-report-v2'] as const;
export const NPR_ACCOUNT_BALANCE_HISTORY_QUERY_KEY = ['npr-account-balance-history', 'ledger-report-v2'] as const;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}

function compareActivity(
  a: { date: string; createdAt: string; id: string; source: string },
  b: { date: string; createdAt: string; id: string; source: string },
) {
  return a.date.localeCompare(b.date)
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id)
    || a.source.localeCompare(b.source);
}

export interface UsdTransferBalanceAfter {
  from: number | null;
  to: number | null;
}

export interface UsdAccountLedgerSummary {
  openingBalance: number;
  transactionIncoming: number;
  transactionIncomingCount: number;
  transactionOutgoing: number;
  transactionOutgoingCount: number;
  transferIncoming: number;
  transferIncomingCount: number;
  transferOutgoing: number;
  transferOutgoingCount: number;
  totalIn: number;
  totalOut: number;
  currentBalance: number;
}

export function useUsdAccountBalanceHistory(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...USD_ACCOUNT_BALANCE_HISTORY_QUERY_KEY, user?.id],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const [
        { data: accounts, error: accountsError },
        transactions,
        transfers,
      ] = await Promise.all([
        supabase.from('paypal_accounts').select('id, opening_balance_amount').order('id'),
        fetchAllPages((from, to) => supabase
          .from('transactions')
          .select('id, paypal_account_id, txn_date, created_at, txn_type, amount')
          .order('txn_date', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllPages((from, to) => supabase
          .from('wallet_transfers')
          .select('id, from_wallet_id, to_wallet_id, transfer_date, created_at, amount, total')
          .order('transfer_date', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)),
      ]);

      if (accountsError) throw accountsError;

      const balances = new Map<string, number>(
        (accounts || []).map((account) => [
          account.id,
          Number(account.opening_balance_amount) || 0,
        ]),
      );
      const accountSummaries: Record<string, UsdAccountLedgerSummary> = {};
      for (const account of accounts || []) {
        const openingBalance = Number(account.opening_balance_amount) || 0;
        accountSummaries[account.id] = {
          openingBalance,
          transactionIncoming: 0,
          transactionIncomingCount: 0,
          transactionOutgoing: 0,
          transactionOutgoingCount: 0,
          transferIncoming: 0,
          transferIncomingCount: 0,
          transferOutgoing: 0,
          transferOutgoingCount: 0,
          totalIn: 0,
          totalOut: 0,
          currentBalance: openingBalance,
        };
      }

      const events = [
        ...transactions.map((transaction) => ({
          date: transaction.txn_date,
          createdAt: transaction.created_at,
          id: transaction.id,
          source: 'transaction',
          transaction,
        })),
        ...transfers.map((transfer) => ({
          date: transfer.transfer_date,
          createdAt: transfer.created_at,
          id: transfer.id,
          source: 'transfer',
          transfer,
        })),
      ].sort(compareActivity);

      const transactionBalanceAfter: Record<string, number> = {};
      const transferBalanceAfter: Record<string, UsdTransferBalanceAfter> = {};

      for (const event of events) {
        if ('transaction' in event) {
          const transaction = event.transaction;
          const accountId = transaction.paypal_account_id;
          if (!accountId) continue;

          const currentBalance = balances.get(accountId) || 0;
          const amount = Number(transaction.amount) || 0;
          const isIncoming = transaction.txn_type === 'INCOMING';
          const balanceAfter = currentBalance + (isIncoming ? amount : -amount);
          balances.set(accountId, balanceAfter);
          const summary = accountSummaries[accountId];
          if (summary) {
            if (isIncoming) {
              summary.transactionIncoming += amount;
              summary.transactionIncomingCount += 1;
            } else {
              summary.transactionOutgoing += amount;
              summary.transactionOutgoingCount += 1;
            }
          }
          transactionBalanceAfter[transaction.id] = balanceAfter;
          continue;
        }

        const transfer = event.transfer;
        let after = transferBalanceAfter[transfer.id];
        if (!after) after = { from: null, to: null };

        if (transfer.from_wallet_id) {
          const currentBalance = balances.get(transfer.from_wallet_id) || 0;
          const deducted = Number(transfer.total ?? transfer.amount) || 0;
          const balanceAfter = currentBalance - deducted;
          balances.set(transfer.from_wallet_id, balanceAfter);
          const summary = accountSummaries[transfer.from_wallet_id];
          if (summary) {
            summary.transferOutgoing += deducted;
            summary.transferOutgoingCount += 1;
          }
          after.from = balanceAfter;
        }

        if (transfer.to_wallet_id) {
          const currentBalance = balances.get(transfer.to_wallet_id) || 0;
          const received = Number(transfer.amount) || 0;
          const balanceAfter = currentBalance + received;
          balances.set(transfer.to_wallet_id, balanceAfter);
          const summary = accountSummaries[transfer.to_wallet_id];
          if (summary) {
            summary.transferIncoming += received;
            summary.transferIncomingCount += 1;
          }
          after.to = balanceAfter;
        }

        transferBalanceAfter[transfer.id] = after;
      }

      for (const [accountId, summary] of Object.entries(accountSummaries)) {
        summary.totalIn = summary.transactionIncoming + summary.transferIncoming;
        summary.totalOut = summary.transactionOutgoing + summary.transferOutgoing;
        summary.currentBalance = balances.get(accountId) ?? summary.openingBalance;
      }

      return { transactionBalanceAfter, transferBalanceAfter, accountSummaries };
    },
  });
}

export interface NprTransferBalanceAfter {
  from: number | null;
  to: number | null;
}

export interface NprAccountLedgerSummary {
  openingBalance: number;
  credits: number;
  creditCount: number;
  debits: number;
  debitCount: number;
  transferIncoming: number;
  transferIncomingCount: number;
  transferOutgoing: number;
  transferOutgoingCount: number;
  totalIn: number;
  totalOut: number;
  currentBalance: number;
}

export function useNprAccountBalanceHistory(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...NPR_ACCOUNT_BALANCE_HISTORY_QUERY_KEY, user?.id],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const [
        { data: accounts, error: accountsError },
        ledgerEntries,
      ] = await Promise.all([
        supabase.from('nepali_accounts').select('id, opening_balance_npr').order('id'),
        fetchAllPages((from, to) => supabase
          .from('nepali_account_ledger')
          .select('id, nepali_account_id, entry_date, created_at, entry_type, amount_npr, source_type, source_id')
          .order('entry_date', { ascending: true })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)),
      ]);

      if (accountsError) throw accountsError;

      const balances = new Map<string, number>(
        (accounts || []).map((account) => [
          account.id,
          Number(account.opening_balance_npr) || 0,
        ]),
      );
      const accountSummaries: Record<string, NprAccountLedgerSummary> = {};
      for (const account of accounts || []) {
        const openingBalance = Number(account.opening_balance_npr) || 0;
        accountSummaries[account.id] = {
          openingBalance,
          credits: 0,
          creditCount: 0,
          debits: 0,
          debitCount: 0,
          transferIncoming: 0,
          transferIncomingCount: 0,
          transferOutgoing: 0,
          transferOutgoingCount: 0,
          totalIn: 0,
          totalOut: 0,
          currentBalance: openingBalance,
        };
      }
      const partyTransactionBalanceAfter: Record<string, number> = {};
      const transferBalanceAfter: Record<string, NprTransferBalanceAfter> = {};

      for (const entry of ledgerEntries.sort((a, b) => compareActivity(
        { date: a.entry_date, createdAt: a.created_at, id: a.id, source: a.source_type || '' },
        { date: b.entry_date, createdAt: b.created_at, id: b.id, source: b.source_type || '' },
      ))) {
        if (!entry.nepali_account_id) continue;

        const currentBalance = balances.get(entry.nepali_account_id) || 0;
        const amount = Number(entry.amount_npr) || 0;
        const addsToBalance = entry.entry_type === 'CREDIT' || entry.entry_type === 'TRANSFER_IN';
        const balanceAfter = currentBalance + (addsToBalance ? amount : -amount);
        balances.set(entry.nepali_account_id, balanceAfter);
        const summary = accountSummaries[entry.nepali_account_id];
        if (summary) {
          if (entry.entry_type === 'CREDIT') {
            summary.credits += amount;
            summary.creditCount += 1;
          } else if (entry.entry_type === 'DEBIT') {
            summary.debits += amount;
            summary.debitCount += 1;
          } else if (entry.entry_type === 'TRANSFER_IN') {
            summary.transferIncoming += amount;
            summary.transferIncomingCount += 1;
          } else if (entry.entry_type === 'TRANSFER_OUT') {
            summary.transferOutgoing += amount;
            summary.transferOutgoingCount += 1;
          }
        }

        if (entry.source_id && (entry.source_type === 'PARTY_RECEIVE' || entry.source_type === 'PARTY_PAY')) {
          partyTransactionBalanceAfter[entry.source_id] = balanceAfter;
        }

        if (entry.source_id && entry.source_type === 'TRANSFER') {
          const after = transferBalanceAfter[entry.source_id] || { from: null, to: null };
          if (entry.entry_type === 'TRANSFER_OUT') after.from = balanceAfter;
          if (entry.entry_type === 'TRANSFER_IN') after.to = balanceAfter;
          transferBalanceAfter[entry.source_id] = after;
        }
      }

      for (const [accountId, summary] of Object.entries(accountSummaries)) {
        summary.totalIn = summary.credits + summary.transferIncoming;
        summary.totalOut = summary.debits + summary.transferOutgoing;
        summary.currentBalance = balances.get(accountId) ?? summary.openingBalance;
      }

      return { partyTransactionBalanceAfter, transferBalanceAfter, accountSummaries };
    },
  });
}