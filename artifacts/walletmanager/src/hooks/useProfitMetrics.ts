import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export type DateFilterType = 'today' | 'this_month' | 'last_month' | 'custom';

export interface DateFilter {
  type: DateFilterType;
  startDate: string;
  endDate: string;
}

export interface ProfitMetrics {
  totalIncomingUsd: number;
  totalOutgoingUsd: number;
  weightedAvgIncomingRate: number;
  weightedAvgOutgoingRate: number;
  profitNpr: number;
  receivedUsd: number;
  sentUsd: number;
}

export interface TotalWalletBalance {
  totalBalanceUsd: number;
  walletCount: number;
}

/**
 * Get date range based on filter type
 */
export function getDateRange(filterType: DateFilterType, customStart?: string, customEnd?: string): DateFilter {
  const today = new Date();
  
  switch (filterType) {
    case 'today': {
      const todayStr = format(today, 'yyyy-MM-dd');
      return {
        type: 'today',
        startDate: todayStr,
        endDate: todayStr,
      };
    }
    case 'this_month': {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return {
        type: 'this_month',
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }
    case 'last_month': {
      const lastMonth = subMonths(today, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      return {
        type: 'last_month',
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }
    case 'custom': {
      return {
        type: 'custom',
        startDate: customStart || format(startOfMonth(today), 'yyyy-MM-dd'),
        endDate: customEnd || format(today, 'yyyy-MM-dd'),
      };
    }
  }
}

/**
 * Calculate profit metrics using weighted average method
 */
export function useProfitMetrics(dateFilter: DateFilter) {
  return useQuery({
    queryKey: ['profit-metrics', dateFilter.startDate, dateFilter.endDate],
    queryFn: async (): Promise<ProfitMetrics> => {
      const { startDate, endDate } = dateFilter;

      // Get all transactions in date range
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('txn_type, amount, rate')
        .gte('txn_date', startDate)
        .lte('txn_date', endDate);

      if (error) throw error;

      let totalIncomingUsd = 0;
      let totalOutgoingUsd = 0;
      let sumIncomingAmountRate = 0; // SUM(amount * rate) for INCOMING
      let sumOutgoingAmountRate = 0; // SUM(amount * rate) for OUTGOING

      transactions?.forEach(txn => {
        const amount = Number(txn.amount);
        const rate = Number(txn.rate);

        if (txn.txn_type === 'INCOMING') {
          totalIncomingUsd += amount;
          sumIncomingAmountRate += amount * rate;
        } else {
          totalOutgoingUsd += amount;
          sumOutgoingAmountRate += amount * rate;
        }
      });

      // Calculate weighted averages
      // If no transactions of that type, use fallback logic
      let weightedAvgIncomingRate = 0;
      let weightedAvgOutgoingRate = 0;

      if (totalIncomingUsd > 0) {
        weightedAvgIncomingRate = sumIncomingAmountRate / totalIncomingUsd;
      } else {
        // Fallback: get last known weighted average from previous transactions
        const { data: prevIncoming } = await supabase
          .from('transactions')
          .select('amount, rate')
          .eq('txn_type', 'INCOMING')
          .lt('txn_date', startDate)
          .order('txn_date', { ascending: false })
          .limit(100);

        if (prevIncoming && prevIncoming.length > 0) {
          let prevSum = 0;
          let prevSumAmountRate = 0;
          prevIncoming.forEach(t => {
            const amt = Number(t.amount);
            prevSum += amt;
            prevSumAmountRate += amt * Number(t.rate);
          });
          if (prevSum > 0) {
            weightedAvgIncomingRate = prevSumAmountRate / prevSum;
          }
        }
      }

      if (totalOutgoingUsd > 0) {
        weightedAvgOutgoingRate = sumOutgoingAmountRate / totalOutgoingUsd;
      }

      // Profit formula (NPR):
      // profit_npr = total_outgoing_usd * (weighted_avg_outgoing_rate - weighted_avg_incoming_rate)
      // If no outgoing, profit is 0
      let profitNpr = 0;
      if (totalOutgoingUsd > 0 && weightedAvgIncomingRate > 0) {
        profitNpr = totalOutgoingUsd * (weightedAvgOutgoingRate - weightedAvgIncomingRate);
      }

      return {
        totalIncomingUsd,
        totalOutgoingUsd,
        weightedAvgIncomingRate,
        weightedAvgOutgoingRate,
        profitNpr,
        receivedUsd: totalIncomingUsd,
        sentUsd: totalOutgoingUsd,
      };
    },
  });
}

/**
 * Calculate total wallet available balance across all wallets (USD)
 */
export function useTotalWalletBalance() {
  return useQuery({
    queryKey: ['total-wallet-balance'],
    queryFn: async (): Promise<TotalWalletBalance> => {
      // Use authoritative view to avoid 1000-row limit issues
      const { data, error } = await supabase
        .from('paypal_accounts_with_balance')
        .select('id, balance');

      if (error) throw error;

      let totalBalanceUsd = 0;
      data?.forEach(row => {
        totalBalanceUsd += Number(row.balance) || 0;
      });

      return {
        totalBalanceUsd,
        walletCount: data?.length || 0,
      };
    },
  });
}
