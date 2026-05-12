import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats, PaypalSummary, EmailPerformance, PartySummary } from '@/lib/types';
import { format, subDays } from 'date-fns';

/**
 * Dashboard stats - ALL VALUES IN USD (uses amount, not total)
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const today = new Date();
      const sevenDaysAgo = format(subDays(today, 7), 'yyyy-MM-dd');
      const thirtyDaysAgo = format(subDays(today, 30), 'yyyy-MM-dd');

      // Get all transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('txn_type, amount, txn_date');
      
      if (error) throw error;

      let total_received = 0;
      let total_sent = 0;
      let last_7d_count = 0;
      let last_7d_total = 0;
      let last_30d_count = 0;
      let last_30d_total = 0;

      transactions?.forEach(txn => {
        const amount = Number(txn.amount);
        if (txn.txn_type === 'INCOMING') {
          total_received += amount;
          if (txn.txn_date >= sevenDaysAgo) {
            last_7d_count++;
            last_7d_total += amount;
          }
          if (txn.txn_date >= thirtyDaysAgo) {
            last_30d_count++;
            last_30d_total += amount;
          }
        } else {
          total_sent += amount;
        }
      });

      return {
        total_received,
        total_sent,
        net_balance: total_received - total_sent,
        last_7d_count,
        last_7d_total,
        last_30d_count,
        last_30d_total,
      };
    },
  });
}

/**
 * Wallet summary - ALL VALUES IN USD (uses amount, not total)
 */
export function usePaypalSummary() {
  return useQuery({
    queryKey: ['dashboard', 'paypal-summary'],
    queryFn: async (): Promise<PaypalSummary[]> => {
      const today = new Date();
      const sevenDaysAgo = format(subDays(today, 7), 'yyyy-MM-dd');
      const thirtyDaysAgo = format(subDays(today, 30), 'yyyy-MM-dd');

      // Get all paypal accounts with opening balance
      const { data: accounts, error: accountsError } = await supabase
        .from('paypal_accounts')
        .select('*')
        .order('paypal_name');
      
      if (accountsError) throw accountsError;

      // Get all active emails count per account
      const { data: emails, error: emailsError } = await supabase
        .from('paypal_emails')
        .select('paypal_account_id, status');
      
      if (emailsError) throw emailsError;

      // Get all transactions (amount in USD)
      const { data: transactions, error: txnError } = await supabase
        .from('transactions')
        .select('paypal_account_id, txn_type, amount, txn_date');
      
      if (txnError) throw txnError;

      // Get all wallet transfers (amount in USD, total = amount + fee for deduction)
      const { data: transfers, error: transfersError } = await supabase
        .from('wallet_transfers')
        .select('from_wallet_id, to_wallet_id, amount, total');
      
      if (transfersError) throw transfersError;

      return accounts?.map(account => {
        const activeEmails = emails?.filter(
          e => e.paypal_account_id === account.id && e.status === 'ACTIVE'
        ).length || 0;

        const accountTxns = transactions?.filter(t => t.paypal_account_id === account.id) || [];
        
        let total_received = 0;
        let total_sent = 0;
        let last_7d_count = 0;
        let last_7d_total = 0;
        let last_30d_count = 0;
        let last_30d_total = 0;

        accountTxns.forEach(txn => {
          const amount = Number(txn.amount);
          if (txn.txn_type === 'INCOMING') {
            total_received += amount;
            if (txn.txn_date >= sevenDaysAgo) {
              last_7d_count++;
              last_7d_total += amount;
            }
            if (txn.txn_date >= thirtyDaysAgo) {
              last_30d_count++;
              last_30d_total += amount;
            }
          } else {
            total_sent += amount;
          }
        });

        // Calculate transfers in/out for this wallet (USD)
        // transfers_in = amount received (just the amount, not fee)
        // transfers_out = total deducted (amount + fee)
        const transfersIn = transfers?.filter(t => t.to_wallet_id === account.id) || [];
        const transfersOut = transfers?.filter(t => t.from_wallet_id === account.id) || [];
        
        const transfers_in = transfersIn.reduce((sum, t) => sum + Number(t.amount), 0);
        const transfers_out = transfersOut.reduce((sum, t) => sum + Number(t.total), 0); // total = amount + fee

        // Balance in USD only
        const opening_amount = Number(account.opening_balance_amount) || 0;
        const balance = opening_amount + total_received - total_sent + transfers_in - transfers_out;

        return {
          id: account.id,
          paypal_name: account.paypal_name,
          is_active: account.is_active,
          active_emails_count: activeEmails,
          opening_balance_amount: opening_amount,
          opening_balance_total: Number(account.opening_balance_total) || 0,
          total_received,
          total_sent,
          transfers_in,
          transfers_out,
          balance,
          balance_npr: 0, // Not used anymore
          last_7d_count,
          last_7d_total,
          last_30d_count,
          last_30d_total,
        };
      }) || [];
    },
  });
}

/**
 * Per-wallet IN/OUT stats for a given date range (USD)
 */
export interface WalletPeriodStats {
  paypal_account_id: string;
  in_count: number;
  in_total: number;
  out_count: number;
  out_total: number;
}

export function useWalletPeriodStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['dashboard', 'wallet-period-stats', startDate, endDate],
    queryFn: async (): Promise<Record<string, WalletPeriodStats>> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('paypal_account_id, txn_type, amount')
        .gte('txn_date', startDate)
        .lte('txn_date', endDate);

      if (error) throw error;

      const map: Record<string, WalletPeriodStats> = {};
      data?.forEach((t) => {
        const id = t.paypal_account_id;
        if (!map[id]) map[id] = { paypal_account_id: id, in_count: 0, in_total: 0, out_count: 0, out_total: 0 };
        const amt = Number(t.amount);
        if (t.txn_type === 'INCOMING') {
          map[id].in_count++;
          map[id].in_total += amt;
        } else {
          map[id].out_count++;
          map[id].out_total += amt;
        }
      });
      return map;
    },
  });
}

/**
 * Email performance - uses USD amounts
 */
export function useEmailPerformance(days: 7 | 30 = 7) {
  return useQuery({
    queryKey: ['dashboard', 'email-performance', days],
    queryFn: async (): Promise<EmailPerformance[]> => {
      const today = new Date();
      const startDate = format(subDays(today, days), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          paypal_email_id,
          amount,
          paypal_emails(email, paypal_account_id),
          paypal_accounts(paypal_name)
        `)
        .eq('txn_type', 'INCOMING')
        .gte('txn_date', startDate);
      
      if (error) throw error;

      // Group by email
      const emailMap = new Map<string, EmailPerformance>();
      
      data?.forEach(txn => {
        if (!txn.paypal_email_id) return;
        const emailId = txn.paypal_email_id;
        const existing = emailMap.get(emailId);
        
        if (existing) {
          existing.incoming_count++;
          existing.incoming_total += Number(txn.amount);
        } else {
          emailMap.set(emailId, {
            email: txn.paypal_emails?.email || '',
            paypal_name: txn.paypal_accounts?.paypal_name || '',
            paypal_account_id: txn.paypal_emails?.paypal_account_id || '',
            incoming_count: 1,
            incoming_total: Number(txn.amount),
          });
        }
      });

      return Array.from(emailMap.values()).sort((a, b) => b.incoming_total - a.incoming_total);
    },
  });
}

/**
 * Inactive emails - emails that have no transactions in the given date range
 */
export interface InactiveEmailInfo {
  id: string;
  email: string;
  paypal_name: string;
  paypal_account_id: string;
  status: string;
  incoming_count: number;
  outgoing_count: number;
}

export function useInactiveEmails(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['dashboard', 'inactive-emails', dateFrom, dateTo],
    queryFn: async (): Promise<InactiveEmailInfo[]> => {
      // Get all active emails
      const { data: emails, error: emailsError } = await supabase
        .from('paypal_emails')
        .select(`
          id,
          email,
          status,
          paypal_account_id,
          paypal_accounts(paypal_name)
        `)
        .eq('status', 'INACTIVE');
      
      if (emailsError) throw emailsError;

      // Get transactions in date range to find active email IDs
      let txnQuery = supabase
        .from('transactions')
        .select('paypal_email_id')
        .not('paypal_email_id', 'is', null);

      if (dateFrom) {
        txnQuery = txnQuery.gte('txn_date', dateFrom);
      }
      if (dateTo) {
        txnQuery = txnQuery.lte('txn_date', dateTo);
      }

      const { data: transactions, error: txnError } = await txnQuery;
      if (txnError) throw txnError;

      // Get unique email IDs that have transactions
      const activeEmailIds = new Set(transactions?.map(t => t.paypal_email_id).filter(Boolean));

      // Filter to emails that are INACTIVE status or have no transactions in range
      // For this implementation, we return INACTIVE status emails
      return emails?.map(e => ({
        id: e.id,
        email: e.email,
        paypal_name: (e.paypal_accounts as any)?.paypal_name || '',
        paypal_account_id: e.paypal_account_id,
        status: e.status,
        incoming_count: 0,
        outgoing_count: 0,
      })) || [];
    },
  });
}

/**
 * Emails with no activity in date range (regardless of status)
 */
export function useEmailsWithNoActivity(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['dashboard', 'emails-no-activity', dateFrom, dateTo],
    queryFn: async (): Promise<InactiveEmailInfo[]> => {
      // Get all emails
      const { data: emails, error: emailsError } = await supabase
        .from('paypal_emails')
        .select(`
          id,
          email,
          status,
          paypal_account_id,
          paypal_accounts(paypal_name, is_active)
        `);
      
      if (emailsError) throw emailsError;

      // Get transactions in date range with txn_type
      let txnQuery = supabase
        .from('transactions')
        .select('paypal_email_id, txn_type')
        .not('paypal_email_id', 'is', null);

      if (dateFrom) {
        txnQuery = txnQuery.gte('txn_date', dateFrom);
      }
      if (dateTo) {
        txnQuery = txnQuery.lte('txn_date', dateTo);
      }

      const { data: transactions, error: txnError } = await txnQuery;
      if (txnError) throw txnError;

      // Build counts per email
      const emailCounts: Record<string, { incoming: number; outgoing: number }> = {};
      transactions?.forEach(t => {
        if (t.paypal_email_id) {
          if (!emailCounts[t.paypal_email_id]) {
            emailCounts[t.paypal_email_id] = { incoming: 0, outgoing: 0 };
          }
          if (t.txn_type === 'INCOMING') {
            emailCounts[t.paypal_email_id].incoming++;
          } else {
            emailCounts[t.paypal_email_id].outgoing++;
          }
        }
      });

      const activeEmailIds = new Set(Object.keys(emailCounts));

      // Only include emails whose wallet is ACTIVE and have NO transactions in range
      return emails?.filter(e => {
        const walletActive = (e.paypal_accounts as any)?.is_active === true;
        return walletActive && !activeEmailIds.has(e.id);
      }).map(e => ({
        id: e.id,
        email: e.email,
        paypal_name: (e.paypal_accounts as any)?.paypal_name || '',
        paypal_account_id: e.paypal_account_id,
        status: e.status,
        incoming_count: 0,
        outgoing_count: 0,
      })) || [];
    },
  });
}

/**
 * Party summary for Receivable/Payable - uses party_transactions table
 * Calculates from party ledger entries:
 * - OUTGOING = We sent money = They owe us = RECEIVABLE (लिनुपर्ने)
 * - INCOMING = We received money = We owe them = PAYABLE (दिनुपर्ने)
 */
export function usePartySummary() {
  return useQuery({
    queryKey: ['dashboard', 'party-summary'],
    queryFn: async (): Promise<PartySummary[]> => {
      // Get all parties
      const { data: parties, error: partiesError } = await supabase
        .from('parties')
        .select('*')
        .order('party_name');
      
      if (partiesError) throw partiesError;

      // Get ALL party_transactions for calculations (paginate to avoid 1000-row limit)
      let allPartyTransactions: Array<{ party_id: string; entry_type: string; amount_npr: number; created_at: string }> = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: batch, error: ptError } = await supabase
          .from('party_transactions')
          .select('party_id, entry_type, amount_npr, created_at')
          .range(from, from + pageSize - 1);
        
        if (ptError) throw ptError;
        if (!batch || batch.length === 0) break;
        allPartyTransactions = allPartyTransactions.concat(batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      const partyTransactions = allPartyTransactions;

      return parties?.map(party => {
        const partyEntries = partyTransactions?.filter(t => t.party_id === party.id) || [];
        
        let totalOutgoing = 0; // OUTGOING = लिनुपर्ने (Receivable)
        let totalIncoming = 0; // INCOMING = दिनुपर्ने (Payable)
        let latestEntryDate: string | null = null;

        partyEntries.forEach(entry => {
          const amount = Number(entry.amount_npr);
          if (entry.entry_type === 'OUTGOING') {
            totalOutgoing += amount;
          } else if (entry.entry_type === 'INCOMING') {
            totalIncoming += amount;
          }
          // Track latest entry date for sorting
          if (!latestEntryDate || entry.created_at > latestEntryDate) {
            latestEntryDate = entry.created_at;
          }
        });

        // Net = Outgoing - Incoming
        // Positive = Receivable, Negative = Payable
        const net = totalOutgoing - totalIncoming;
        const receivable = net > 0 ? net : 0;
        const payable = net < 0 ? Math.abs(net) : 0;

        let status: 'RECEIVABLE' | 'PAYABLE' | 'SETTLED' = 'SETTLED';
        if (net > 0) status = 'RECEIVABLE';
        else if (net < 0) status = 'PAYABLE';

        return {
          id: party.id,
          party_name: party.party_name,
          phone: party.phone,
          receivable,
          payable,
          receivableUsd: 0,
          payableUsd: 0,
          net,
          unsettled_count: partyEntries.length,
          missing_rate_count: 0,
          status,
          latestEntryDate,
        };
      }) || [];
    },
  });
}
