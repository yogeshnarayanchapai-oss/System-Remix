export type EmailStatus = 'ACTIVE' | 'INACTIVE';
export type TxnType = 'INCOMING' | 'OUTGOING';
export type UserRole = 'ADMIN';

export interface PaypalAccount {
  id: string;
  paypal_name: string;
  note: string | null;
  is_active: boolean;
  opening_balance_amount: number;
  opening_balance_rate: number;
  opening_balance_total: number;
  created_at: string;
  updated_at: string;
}

export interface PaypalEmail {
  id: string;
  paypal_account_id: string;
  email: string;
  status: EmailStatus;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  paypal_accounts?: PaypalAccount;
}

export interface Party {
  id: string;
  party_name: string;
  phone: string | null;
  note: string | null;
  default_rate: number | null;
  secret_code: string | null;
  email: string | null;
  password_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  txn_date: string;
  txn_type: TxnType;
  party_id: string;
  paypal_account_id: string;
  paypal_email_id: string | null;
  amount: number;
  rate: number;
  total: number;
  remark: string | null;
  reference_id: string | null;
  is_settled: boolean;
  settled_at: string | null;
  settlement_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  parties?: Party;
  paypal_accounts?: PaypalAccount;
  paypal_emails?: PaypalEmail | null;
}

export interface WalletTransfer {
  id: string;
  transfer_date: string;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number;
  rate: number;
  total: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
  from_wallet?: PaypalAccount;
  to_wallet?: PaypalAccount;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface ActiveAccount {
  id: string;
  email: string;
  password: string;
  totp_secret: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

// Computed types for dashboard - ALL USD unless noted
export interface PaypalSummary {
  id: string;
  paypal_name: string;
  is_active: boolean;
  active_emails_count: number;
  opening_balance_amount: number;  // USD
  opening_balance_total: number;   // NPR (for reference only)
  total_received: number;          // USD
  total_sent: number;              // USD
  transfers_in: number;            // USD
  transfers_out: number;           // USD
  balance: number;                 // USD
  balance_npr: number;             // Deprecated, not used
  last_7d_count: number;
  last_7d_total: number;           // USD
  last_30d_count: number;
  last_30d_total: number;          // USD
}

export interface EmailPerformance {
  email: string;
  paypal_name: string;
  paypal_account_id: string;
  incoming_count: number;
  incoming_total: number;          // USD
}

// Party summary - NPR for Receivable/Payable page only
export interface PartySummary {
  id: string;
  party_name: string;
  phone: string | null;
  receivable: number;       // NPR - Sum of OUTGOING total (unsettled)
  payable: number;          // NPR - Sum of INCOMING total (unsettled)
  receivableUsd?: number;   // USD reference
  payableUsd?: number;      // USD reference
  net: number;              // NPR - receivable - payable
  unsettled_count: number;
  missing_rate_count?: number;
  latestEntryDate?: string | null;  // For sorting by recent activity
  status: 'RECEIVABLE' | 'PAYABLE' | 'SETTLED';
}

export interface DashboardStats {
  total_received: number;   // USD
  total_sent: number;       // USD
  net_balance: number;      // USD
  last_7d_count: number;
  last_7d_total: number;    // USD
  last_30d_count: number;
  last_30d_total: number;   // USD
}
