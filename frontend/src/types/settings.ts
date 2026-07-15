export type VatRateCategory = "VAT_16" | "VAT_8" | "ZERO_RATED" | "EXEMPT";
export type BaseAmountPolicy = "skip" | "reject_session" | "treat_as_zero";
export type UnmappedVatPolicy = "reject_invoice" | "needs_review";
export type VatModule = "sales" | "purchases";

// SAP field holding the Purchase Invoice CU number. Values are the exact SAP field names.
export type PurchaseCUField = "U_CUINV" | "NumAtCard" | "Comments" | "JournalMemo" | "Reference1";

export interface SAPConnection {
  id: number;
  name: string;
  base_url: string;
  company_db: string;
  username: string;
  password_set: boolean;
  verify_ssl: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  id: number;
  active_connection_id: number | null;
  amount_tolerance: string;
  base_amount_policy: BaseAmountPolicy;
  unmapped_vat_policy: UnmappedVatPolicy;
  ignore_missing_cu: boolean;
  include_credit_notes: boolean;
  include_debit_notes: boolean;
  skip_cancelled: boolean;
  purchase_cu_source: PurchaseCUField;
  kra_csv_pin_column: number;
  kra_csv_partner_name_column: number;
  kra_csv_invoice_number_column: number;
  kra_csv_invoice_date_column: number;
  kra_csv_cu_number_column: number;
  kra_csv_vat_group_column: number;
  kra_csv_base_amount_column: number;
  version: number;
  updated_at: string;
  warning?: string | null;
}

export interface VATMappingItem {
  id?: number;
  module: VatModule;
  sap_code: string;
  description: string;
  canonical_value: VatRateCategory;
  is_builtin: boolean;
}

export interface KRAVATMappingItem {
  id?: number;
  section_prefix: string;
  canonical_value: VatRateCategory;
}

export interface SettingsComposite {
  sap_connection: SAPConnection | null;
  system_settings: SystemSettings;
  vat_mappings: VATMappingItem[];
  kra_vat_mappings: KRAVATMappingItem[];
  is_using_env_fallback: boolean;
}

export interface StepResult {
  status: "pass" | "fail" | "warn";
  message: string;
}

export interface TestConnectionResponse {
  connected: boolean;
  steps: Record<string, StepResult>;
  error_message?: string | null;
  metadata?: {
    system_version?: string;
    company_name?: string;
    connected_user?: string;
    database_name?: string;
    latency_ms?: number;
  } | null;
}

export interface SettingAuditLog {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  changes_json: Record<string, { old: any; new: any }>;
  reason?: string | null;
  created_at: string;
}
