import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export interface AccessLog {
  id: string;
  party_name: string;
  ip_address: string | null;
  action: string;
  created_at: string;
  route: string | null;
  status: string | null;
  meta: Json | null;
  user_agent: string | null;
  session_id: string | null;
  actor_email: string | null;
}

export interface PartyLogSummary {
  party_name: string;
  total_access: number;
  success_count: number;
  fail_count: number;
  last_access: string;
  ip_addresses: string[];
  actions: Record<string, number>;
}

export function useAccessLogs(filters?: {
  action?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["access-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters?.action) {
        query = query.eq("action", filters.action);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AccessLog[];
    },
  });
}

export function useAccessLogsSummary() {
  return useQuery({
    queryKey: ["access-logs-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by party_name
      const logs = data as AccessLog[];
      const summaryMap = new Map<string, PartyLogSummary>();

      for (const log of logs) {
        const existing = summaryMap.get(log.party_name);
        if (existing) {
          existing.total_access++;
          if (log.status === "SUCCESS") existing.success_count++;
          if (log.status === "FAIL") existing.fail_count++;
          if (log.ip_address && !existing.ip_addresses.includes(log.ip_address)) {
            existing.ip_addresses.push(log.ip_address);
          }
          existing.actions[log.action] = (existing.actions[log.action] || 0) + 1;
        } else {
          summaryMap.set(log.party_name, {
            party_name: log.party_name,
            total_access: 1,
            success_count: log.status === "SUCCESS" ? 1 : 0,
            fail_count: log.status === "FAIL" ? 1 : 0,
            last_access: log.created_at,
            ip_addresses: log.ip_address ? [log.ip_address] : [],
            actions: { [log.action]: 1 },
          });
        }
      }

      return Array.from(summaryMap.values()).sort(
        (a, b) => new Date(b.last_access).getTime() - new Date(a.last_access).getTime()
      );
    },
  });
}

// Get unique action types for filter dropdown
export function useAccessLogActions() {
  return useQuery({
    queryKey: ["access-logs-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_logs")
        .select("action")
        .order("action");

      if (error) throw error;
      
      const uniqueActions = [...new Set(data.map(d => d.action))];
      return uniqueActions;
    },
  });
}
