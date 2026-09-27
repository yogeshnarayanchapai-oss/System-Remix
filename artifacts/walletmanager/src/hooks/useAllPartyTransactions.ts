import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  partyId?: string;
  nepaliAccountId?: string | 'none' | 'all';
  remarkSearch?: string;
  page?: number;
  pageSize?: number;
}

export interface PartyTransactionWithDetails {
  id: string;
  entry_date: string;
  entry_type: string;
  amount_npr: number;
  remark: string | null;
  nepali_account_id: string | null;
  source_transaction_id: string | null;
  party_id: string;
  created_at: string;
  party_name: string;
  nepali_account_name: string | null;
}

export function useAllPartyTransactions(filters: TransactionFilters) {
  const { dateFrom, dateTo, partyId, nepaliAccountId, remarkSearch, page = 1, pageSize = 50 } = filters;
  
  return useQuery({
    queryKey: ['all-party-transactions', filters],
    queryFn: async () => {
      // Build query
      let query = supabase
        .from('party_transactions')
        .select(`
          id,
          entry_date,
          entry_type,
          amount_npr,
          remark,
          nepali_account_id,
          source_transaction_id,
          party_id,
          created_at,
          parties!inner(party_name),
          nepali_accounts(name)
        `, { count: 'exact' })
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Apply filters
      if (dateFrom) {
        query = query.gte('entry_date', dateFrom);
      }
      if (dateTo) {
        query = query.lte('entry_date', dateTo);
      }
      if (partyId) {
        query = query.eq('party_id', partyId);
      }
      if (nepaliAccountId === 'none') {
        query = query.is('nepali_account_id', null);
      } else if (nepaliAccountId && nepaliAccountId !== 'all') {
        query = query.eq('nepali_account_id', nepaliAccountId);
      }
      if (remarkSearch) {
        query = query.ilike('remark', `%${remarkSearch}%`);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;

      // Transform data
      const transactions: PartyTransactionWithDetails[] = (data || []).map((t: any) => ({
        id: t.id,
        entry_date: t.entry_date,
        entry_type: t.entry_type,
        amount_npr: t.amount_npr,
        remark: t.remark,
        nepali_account_id: t.nepali_account_id,
        source_transaction_id: t.source_transaction_id,
        party_id: t.party_id,
        created_at: t.created_at,
        party_name: t.parties?.party_name || '',
        nepali_account_name: t.nepali_accounts?.name || null,
      }));

      return {
        transactions,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      };
    },
  });
}

export async function fetchAllPartyTransactions(
  filters: Omit<TransactionFilters, 'page' | 'pageSize'>,
): Promise<PartyTransactionWithDetails[]> {
  const pageSize = 1000;
  let offset = 0;
  const allTransactions: PartyTransactionWithDetails[] = [];

  while (true) {
    let query = supabase
      .from('party_transactions')
      .select(`
        id,
        entry_date,
        entry_type,
        amount_npr,
        remark,
        nepali_account_id,
        source_transaction_id,
        party_id,
        created_at,
        parties!inner(party_name),
        nepali_accounts(name)
      `)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.dateFrom) query = query.gte('entry_date', filters.dateFrom);
    if (filters.dateTo) query = query.lte('entry_date', filters.dateTo);
    if (filters.partyId) query = query.eq('party_id', filters.partyId);
    if (filters.nepaliAccountId === 'none') {
      query = query.is('nepali_account_id', null);
    } else if (filters.nepaliAccountId && filters.nepaliAccountId !== 'all') {
      query = query.eq('nepali_account_id', filters.nepaliAccountId);
    }
    if (filters.remarkSearch) query = query.ilike('remark', `%${filters.remarkSearch}%`);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    const batch: PartyTransactionWithDetails[] = (data || []).map((entry: any) => ({
      id: entry.id,
      entry_date: entry.entry_date,
      entry_type: entry.entry_type,
      amount_npr: entry.amount_npr,
      remark: entry.remark,
      nepali_account_id: entry.nepali_account_id,
      source_transaction_id: entry.source_transaction_id,
      party_id: entry.party_id,
      created_at: entry.created_at,
      party_name: entry.parties?.party_name || '',
      nepali_account_name: entry.nepali_accounts?.name || null,
    }));

    allTransactions.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return allTransactions;
}

// Date filter quick options
export type DateQuickFilter = 'today' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom';

export function getDateRangeFromFilter(filter: DateQuickFilter, customFrom?: string, customTo?: string) {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  switch (filter) {
    case 'today':
      return { from: formatDate(today), to: formatDate(today) };
    case '7days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: formatDate(from), to: formatDate(today) };
    }
    case '30days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: formatDate(from), to: formatDate(today) };
    }
    case 'this_month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: formatDate(from), to: formatDate(today) };
    }
    case 'last_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: formatDate(from), to: formatDate(to) };
    }
    case 'custom':
      return { from: customFrom, to: customTo };
    default:
      return { from: undefined, to: undefined };
  }
}
