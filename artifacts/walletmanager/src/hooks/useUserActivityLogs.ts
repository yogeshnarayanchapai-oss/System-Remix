import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Json } from "@/integrations/supabase/types";

export interface UserActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Json | null;
  meta: Json | null;
  created_at: string;
}

export type ActivityAction = 
  | "TRANSACTION_CREATE"
  | "TRANSACTION_UPDATE"
  | "TRANSACTION_DELETE"
  | "PARTY_TXN_CREATE"
  | "PARTY_TXN_UPDATE"
  | "PARTY_TXN_DELETE"
  | "NPR_TRANSFER_CREATE"
  | "NPR_TRANSFER_DELETE"
  | "USD_TRANSFER_CREATE"
  | "USD_TRANSFER_DELETE"
  | "NPR_OPENING_BALANCE_UPDATE"
  | "USD_OPENING_BALANCE_UPDATE"
  | "NEPALI_ACCOUNT_CREATE"
  | "NEPALI_ACCOUNT_UPDATE"
  | "USD_ACCOUNT_CREATE"
  | "USD_ACCOUNT_UPDATE"
  | "NETWORTH_ENTRY_CREATE"
  | "NETWORTH_ENTRY_UPDATE"
  | "NETWORTH_ENTRY_DELETE"
  | "NETWORTH_BULK_IMPORT"
  | "NETWORTH_CATEGORY_CREATE"
  | "NETWORTH_CATEGORY_UPDATE"
  | "NETWORTH_CATEGORY_DELETE"
  | "NETWORTH_SETTINGS_UPDATE";

export type ActivityEntityType = 
  | "transaction"
  | "party_transaction"
  | "npr_transfer"
  | "usd_transfer"
  | "nepali_account"
  | "usd_account"
  | "networth_entry"
  | "networth_category"
  | "networth_settings";

// Action labels and variants for display
export const ACTIVITY_ACTION_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon?: string }> = {
  TRANSACTION_CREATE: { label: "Transaction Created", variant: "default" },
  TRANSACTION_UPDATE: { label: "Transaction Updated", variant: "secondary" },
  TRANSACTION_DELETE: { label: "Transaction Deleted", variant: "destructive" },
  PARTY_TXN_CREATE: { label: "R/P Entry Created", variant: "default" },
  PARTY_TXN_UPDATE: { label: "R/P Entry Updated", variant: "secondary" },
  PARTY_TXN_DELETE: { label: "R/P Entry Deleted", variant: "destructive" },
  NPR_TRANSFER_CREATE: { label: "NPR Transfer Created", variant: "default" },
  NPR_TRANSFER_DELETE: { label: "NPR Transfer Deleted", variant: "destructive" },
  USD_TRANSFER_CREATE: { label: "USD Transfer Created", variant: "default" },
  USD_TRANSFER_DELETE: { label: "USD Transfer Deleted", variant: "destructive" },
  NPR_OPENING_BALANCE_UPDATE: { label: "NPR Opening Balance Updated", variant: "secondary" },
  USD_OPENING_BALANCE_UPDATE: { label: "USD Opening Balance Updated", variant: "secondary" },
  NEPALI_ACCOUNT_CREATE: { label: "NPR Account Created", variant: "default" },
  NEPALI_ACCOUNT_UPDATE: { label: "NPR Account Updated", variant: "secondary" },
  USD_ACCOUNT_CREATE: { label: "USD Account Created", variant: "default" },
  USD_ACCOUNT_UPDATE: { label: "USD Account Updated", variant: "secondary" },
  NETWORTH_ENTRY_CREATE: { label: "Net Worth Entry Created", variant: "default" },
  NETWORTH_ENTRY_UPDATE: { label: "Net Worth Entry Updated", variant: "secondary" },
  NETWORTH_ENTRY_DELETE: { label: "Net Worth Entry Deleted", variant: "destructive" },
  NETWORTH_BULK_IMPORT: { label: "Net Worth Bulk Import", variant: "default" },
  NETWORTH_CATEGORY_CREATE: { label: "Net Worth Category Created", variant: "default" },
  NETWORTH_CATEGORY_UPDATE: { label: "Net Worth Category Updated", variant: "secondary" },
  NETWORTH_CATEGORY_DELETE: { label: "Net Worth Category Deleted", variant: "destructive" },
  NETWORTH_SETTINGS_UPDATE: { label: "Net Worth Settings Updated", variant: "secondary" },
};

// Entity type labels
export const ENTITY_TYPE_CONFIG: Record<string, { label: string }> = {
  transaction: { label: "Transaction" },
  party_transaction: { label: "Receivable/Payable" },
  npr_transfer: { label: "NPR Transfer" },
  usd_transfer: { label: "USD Transfer" },
  nepali_account: { label: "NPR Account" },
  usd_account: { label: "USD Account" },
  networth_entry: { label: "Net Worth Entry" },
  networth_category: { label: "Net Worth Category" },
  networth_settings: { label: "Net Worth Settings" },
};

export function useUserActivityLogs(filters?: {
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  userEmail?: string;
}) {
  return useQuery({
    queryKey: ["user-activity-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("user_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filters?.action && filters.action !== "all") {
        query = query.eq("action", filters.action);
      }
      if (filters?.entityType && filters.entityType !== "all") {
        query = query.eq("entity_type", filters.entityType);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
      }
      if (filters?.userEmail) {
        query = query.ilike("user_email", `%${filters.userEmail}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as UserActivityLog[];
    },
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      action,
      entityType,
      entityId,
      changes,
      meta,
    }: {
      action: ActivityAction;
      entityType: ActivityEntityType;
      entityId: string;
      changes?: Json;
      meta?: Json;
    }) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("user_activity_logs").insert([{
        user_id: user.id,
        user_email: user.email || "unknown",
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes: changes || null,
        meta: meta || null,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-activity-logs"] });
    },
  });
}

// Get unique action types for filter dropdown
export function useActivityLogActions() {
  return useQuery({
    queryKey: ["activity-log-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("action")
        .order("action");

      if (error) throw error;
      
      const uniqueActions = [...new Set(data.map(d => d.action))];
      return uniqueActions;
    },
  });
}

// Get unique entity types for filter dropdown
export function useActivityLogEntityTypes() {
  return useQuery({
    queryKey: ["activity-log-entity-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("entity_type")
        .order("entity_type");

      if (error) throw error;
      
      const uniqueTypes = [...new Set(data.map(d => d.entity_type))];
      return uniqueTypes;
    },
  });
}

// Get unique users for filter dropdown
export function useActivityLogUsers() {
  return useQuery({
    queryKey: ["activity-log-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_activity_logs")
        .select("user_email")
        .order("user_email");

      if (error) throw error;
      
      const uniqueUsers = [...new Set(data.map(d => d.user_email))];
      return uniqueUsers;
    },
  });
}
