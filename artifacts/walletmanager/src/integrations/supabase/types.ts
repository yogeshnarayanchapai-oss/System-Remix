export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          id: string
          ip_address: string | null
          meta: Json | null
          party_name: string
          route: string | null
          session_id: string | null
          status: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          party_name: string
          route?: string | null
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          meta?: Json | null
          party_name?: string
          route?: string | null
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      active_accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          is_primary: boolean | null
          password: string
          totp_secret: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean | null
          password: string
          totp_secret?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean | null
          password?: string
          totp_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      nepali_account_ledger: {
        Row: {
          amount_npr: number
          created_at: string
          entry_date: string
          entry_type: Database["public"]["Enums"]["nepali_ledger_entry_type"]
          id: string
          nepali_account_id: string
          remark: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["nepali_ledger_source_type"]
          updated_at: string
        }
        Insert: {
          amount_npr: number
          created_at?: string
          entry_date?: string
          entry_type: Database["public"]["Enums"]["nepali_ledger_entry_type"]
          id?: string
          nepali_account_id: string
          remark?: string | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["nepali_ledger_source_type"]
          updated_at?: string
        }
        Update: {
          amount_npr?: number
          created_at?: string
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["nepali_ledger_entry_type"]
          id?: string
          nepali_account_id?: string
          remark?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["nepali_ledger_source_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nepali_account_ledger_nepali_account_id_fkey"
            columns: ["nepali_account_id"]
            isOneToOne: false
            referencedRelation: "nepali_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nepali_account_ledger_nepali_account_id_fkey"
            columns: ["nepali_account_id"]
            isOneToOne: false
            referencedRelation: "nepali_accounts_with_balance"
            referencedColumns: ["id"]
          },
        ]
      }
      nepali_accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          opening_balance_npr: number
          status: Database["public"]["Enums"]["nepali_account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          opening_balance_npr?: number
          status?: Database["public"]["Enums"]["nepali_account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          opening_balance_npr?: number
          status?: Database["public"]["Enums"]["nepali_account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      networth_categories: {
        Row: {
          created_at: string
          group_name: Database["public"]["Enums"]["networth_group"]
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["networth_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_name: Database["public"]["Enums"]["networth_group"]
          id?: string
          is_active?: boolean
          name: string
          type: Database["public"]["Enums"]["networth_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_name?: Database["public"]["Enums"]["networth_group"]
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["networth_type"]
          updated_at?: string
        }
        Relationships: []
      }
      networth_entries: {
        Row: {
          amount_npr: number
          category_id: string | null
          category_name: string
          created_at: string
          description: string | null
          entry_date: string
          id: string
          source: string | null
          subcategory_id: string | null
          subcategory_name: string | null
          type: Database["public"]["Enums"]["networth_type"]
          updated_at: string
        }
        Insert: {
          amount_npr: number
          category_id?: string | null
          category_name: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          source?: string | null
          subcategory_id?: string | null
          subcategory_name?: string | null
          type: Database["public"]["Enums"]["networth_type"]
          updated_at?: string
        }
        Update: {
          amount_npr?: number
          category_id?: string | null
          category_name?: string
          created_at?: string
          description?: string | null
          entry_date?: string
          id?: string
          source?: string | null
          subcategory_id?: string | null
          subcategory_name?: string | null
          type?: Database["public"]["Enums"]["networth_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "networth_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "networth_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "networth_entries_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "networth_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      networth_settings: {
        Row: {
          goal_label: string
          goal_start_npr: number
          goal_target_npr: number
          id: string
          updated_at: string
          usd_npr_rate: number
          usd_npr_updated_at: string | null
        }
        Insert: {
          goal_label?: string
          goal_start_npr?: number
          goal_target_npr?: number
          id?: string
          updated_at?: string
          usd_npr_rate?: number
          usd_npr_updated_at?: string | null
        }
        Update: {
          goal_label?: string
          goal_start_npr?: number
          goal_target_npr?: number
          id?: string
          updated_at?: string
          usd_npr_rate?: number
          usd_npr_updated_at?: string | null
        }
        Relationships: []
      }
      networth_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "networth_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "networth_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_sessions: {
        Row: {
          attempts: number
          blocked_until: string | null
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          party_id: string
          resend_available_at: string
          resend_count: number
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          expires_at: string
          id?: string
          otp_hash: string
          party_id: string
          resend_available_at?: string
          resend_count?: number
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          party_id?: string
          resend_available_at?: string
          resend_count?: number
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_sessions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          created_at: string
          default_rate: number | null
          email: string | null
          id: string
          note: string | null
          party_name: string
          password_updated_at: string | null
          phone: string | null
          secret_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_rate?: number | null
          email?: string | null
          id?: string
          note?: string | null
          party_name: string
          password_updated_at?: string | null
          phone?: string | null
          secret_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_rate?: number | null
          email?: string | null
          id?: string
          note?: string | null
          party_name?: string
          password_updated_at?: string | null
          phone?: string | null
          secret_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      party_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_accessed_at: string
          party_id: string
          session_token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_accessed_at?: string
          party_id: string
          session_token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string
          party_id?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_sessions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
        ]
      }
      party_transactions: {
        Row: {
          amount_npr: number
          created_at: string
          entry_date: string
          entry_type: string
          id: string
          nepali_account_id: string | null
          party_id: string
          remark: string | null
          source_transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount_npr: number
          created_at?: string
          entry_date?: string
          entry_type: string
          id?: string
          nepali_account_id?: string | null
          party_id: string
          remark?: string | null
          source_transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_npr?: number
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          nepali_account_id?: string | null
          party_id?: string
          remark?: string | null
          source_transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_transactions_nepali_account_id_fkey"
            columns: ["nepali_account_id"]
            isOneToOne: false
            referencedRelation: "nepali_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_transactions_nepali_account_id_fkey"
            columns: ["nepali_account_id"]
            isOneToOne: false
            referencedRelation: "nepali_accounts_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_transactions_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      paypal_accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          note: string | null
          opening_balance_amount: number | null
          opening_balance_rate: number | null
          opening_balance_total: number | null
          paypal_name: string
          tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          opening_balance_amount?: number | null
          opening_balance_rate?: number | null
          opening_balance_total?: number | null
          paypal_name: string
          tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          opening_balance_amount?: number | null
          opening_balance_rate?: number | null
          opening_balance_total?: number | null
          paypal_name?: string
          tag?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      paypal_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          is_primary: boolean
          paypal_account_id: string
          status: Database["public"]["Enums"]["email_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_primary?: boolean
          paypal_account_id: string
          status?: Database["public"]["Enums"]["email_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_primary?: boolean
          paypal_account_id?: string
          status?: Database["public"]["Enums"]["email_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paypal_emails_paypal_account_id_fkey"
            columns: ["paypal_account_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paypal_emails_paypal_account_id_fkey"
            columns: ["paypal_account_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts_with_balance"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_summary: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["period_type"]
          profit_npr: number
          total_incoming_usd: number
          total_outgoing_usd: number
          updated_at: string
          weighted_avg_incoming_rate: number
          weighted_avg_outgoing_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          period_type: Database["public"]["Enums"]["period_type"]
          profit_npr?: number
          total_incoming_usd?: number
          total_outgoing_usd?: number
          updated_at?: string
          weighted_avg_incoming_rate?: number
          weighted_avg_outgoing_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          period_type?: Database["public"]["Enums"]["period_type"]
          profit_npr?: number
          total_incoming_usd?: number
          total_outgoing_usd?: number
          updated_at?: string
          weighted_avg_incoming_rate?: number
          weighted_avg_outgoing_rate?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          is_settled: boolean
          party_id: string
          paypal_account_id: string
          paypal_email_id: string | null
          rate: number
          reference_id: string | null
          remark: string | null
          settled_at: string | null
          settlement_note: string | null
          total: number
          txn_date: string
          txn_type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_settled?: boolean
          party_id: string
          paypal_account_id: string
          paypal_email_id?: string | null
          rate: number
          reference_id?: string | null
          remark?: string | null
          settled_at?: string | null
          settlement_note?: string | null
          total: number
          txn_date?: string
          txn_type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_settled?: boolean
          party_id?: string
          paypal_account_id?: string
          paypal_email_id?: string | null
          rate?: number
          reference_id?: string | null
          remark?: string | null
          settled_at?: string | null
          settlement_note?: string | null
          total?: number
          txn_date?: string
          txn_type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paypal_account_id_fkey"
            columns: ["paypal_account_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paypal_account_id_fkey"
            columns: ["paypal_account_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_paypal_email_id_fkey"
            columns: ["paypal_email_id"]
            isOneToOne: false
            referencedRelation: "paypal_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          meta: Json | null
          user_email: string
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          meta?: Json | null
          user_email: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          meta?: Json | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      wallet_transfers: {
        Row: {
          amount: number
          created_at: string
          from_wallet_id: string | null
          id: string
          rate: number
          remark: string | null
          to_wallet_id: string | null
          total: number
          transfer_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_wallet_id?: string | null
          id?: string
          rate?: number
          remark?: string | null
          to_wallet_id?: string | null
          total: number
          transfer_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_wallet_id?: string | null
          id?: string
          rate?: number
          remark?: string | null
          to_wallet_id?: string | null
          total?: number
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transfers_from_wallet_id_fkey"
            columns: ["from_wallet_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transfers_from_wallet_id_fkey"
            columns: ["from_wallet_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts_with_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transfers_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transfers_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "paypal_accounts_with_balance"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      nepali_accounts_with_balance: {
        Row: {
          available_balance_npr: number | null
          created_at: string | null
          id: string | null
          name: string | null
          opening_balance_npr: number | null
          status: Database["public"]["Enums"]["nepali_account_status"] | null
          updated_at: string | null
        }
        Relationships: []
      }
      paypal_accounts_with_balance: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_30d_count: number | null
          last_30d_total: number | null
          last_7d_count: number | null
          last_7d_total: number | null
          note: string | null
          opening_balance_amount: number | null
          opening_balance_rate: number | null
          opening_balance_total: number | null
          paypal_name: string | null
          total_received: number | null
          total_sent: number | null
          transfers_in: number | null
          transfers_out: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ADMIN" | "EDITOR"
      email_status: "ACTIVE" | "INACTIVE"
      nepali_account_status: "ACTIVE" | "INACTIVE"
      nepali_ledger_entry_type:
        | "CREDIT"
        | "DEBIT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
      nepali_ledger_source_type: "PARTY_RECEIVE" | "PARTY_PAY" | "TRANSFER"
      networth_group:
        | "LIQUID_ASSETS"
        | "INVESTED_ASSETS"
        | "CONSUMABLE_ASSETS"
        | "SHORT_TERM_LIABILITIES"
        | "LONG_TERM_LIABILITIES"
        | "INCOME"
        | "EXPENSE"
      networth_type: "ASSET" | "LIABILITY"
      period_type: "DAILY" | "MONTHLY" | "CUSTOM"
      txn_type: "INCOMING" | "OUTGOING"
      user_role: "ADMIN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["ADMIN", "EDITOR"],
      email_status: ["ACTIVE", "INACTIVE"],
      nepali_account_status: ["ACTIVE", "INACTIVE"],
      nepali_ledger_entry_type: [
        "CREDIT",
        "DEBIT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ],
      nepali_ledger_source_type: ["PARTY_RECEIVE", "PARTY_PAY", "TRANSFER"],
      networth_group: [
        "LIQUID_ASSETS",
        "INVESTED_ASSETS",
        "CONSUMABLE_ASSETS",
        "SHORT_TERM_LIABILITIES",
        "LONG_TERM_LIABILITIES",
        "INCOME",
        "EXPENSE",
      ],
      networth_type: ["ASSET", "LIABILITY"],
      period_type: ["DAILY", "MONTHLY", "CUSTOM"],
      txn_type: ["INCOMING", "OUTGOING"],
      user_role: ["ADMIN"],
    },
  },
} as const
