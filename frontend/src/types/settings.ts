export type VatRateCategory = "VAT_16" | "VAT_8" | "ZERO_RATED" | "EXEMPT";
export type BaseAmountPolicy = "skip" | "reject_session" | "treat_as_zero";
export type UnmappedVatPolicy = "reject_invoice" | "needs_review";
export type VatModule = "sales" | "purchases";

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

export interface KRAColumnMapping {
  pin: number;
  partner_name: number;
  invoice_number: number;
  invoice_date: number;
  cu_number: number;
  base_amount: number;
  vat_group?: number | null;
}

export interface KRAValidationRules {
  pin_required: boolean;
  allow_negative_amounts: boolean;
}

export interface KRASectionConfig {
  identifier: string;
  display_name: string;
  filename_regex: string;
  vat_group: string;
  required: boolean;
  column_mapping: KRAColumnMapping;
  validation_rules: KRAValidationRules;
  active: boolean;
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
  kra_section_mappings: Record<string, KRASectionConfig>;
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

export interface SettingsComposite {
  sap_connection: SAPConnection | null;
  system_settings: SystemSettings;
  vat_mappings: VATMappingItem[];
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
