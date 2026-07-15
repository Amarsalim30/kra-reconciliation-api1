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
  last_tested_at?: string | null;
  last_status?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  id: number;
  active_connection_id: number | null;
  amount_tolerance: string;
  date_tolerance: number;
  partner_similarity_threshold: number;
  version: number;
  updated_at: string;
  warning?: string | null;
}

export interface VATBucket {
  id: number;
  code: string;
  display_name: string;
  percentage?: number | string | null;
  category: string;
}

export interface KRASection {
  id: number;
  section_code: string;
  display_name: string;
  description?: string | null;
  expected_vat_bucket_code: string;
  allowed_vat_bucket_codes: string[];
  enabled: boolean;
  sort_order: number;
}

export interface SAPVatMappingItem {
  id?: number;
  module: string;
  sap_code: string;
  description: string;
  vat_bucket_code: str;
  is_builtin: boolean;
}

export interface TaxConfiguration {
  vat_buckets: VATBucket[];
  kra_sections: KRASection[];
  vat_mappings: SAPVatMappingItem[];
  coverage: {
    total: number;
    purchases: number;
    sales: number;
    unmapped: number;
  };
}

export interface SettingsComposite {
  sap_connection: SAPConnection | null;
  system_settings: SystemSettings;
  tax_configuration: TaxConfiguration;
  is_using_env_fallback: boolean;
}

export interface DiagnosticCheck {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: "SAP" | "TAX" | "SYSTEM";
  is_blocking: boolean;
  message: string;
  recommendation?: string | null;
}

export interface DiagnosticsReport {
  readiness: "Ready" | "Warning" | "Blocked";
  checks: DiagnosticCheck[];
  coverage: {
    total_mapped: number;
    purchases_mapped: number;
    sales_mapped: number;
    unmapped: number;
    duplicates: number;
  };
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
  user_id?: number | null;
  user_email?: string | null;
  ip_address?: string | null;
  entity?: string | null;
  entity_id?: string | null;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  action: string;
  changes_json: Record<string, any>;
  reason?: string | null;
  created_at: string;
}

export interface ImportDiffItem {
  entity: string;
  key: str;
  old?: string | null;
  new?: string | null;
}

export interface ImportValidationSummary {
  valid: boolean;
  critical_errors?: string[];
  warnings?: string[];
  diffs: ImportDiffItem[];
}

export type InternalField =
  | "invoice_number"
  | "partner_name"
  | "invoice_date"
  | "pin"
  | "cu_number"
  | "cu_serial"
  | "base_amount"
  | "vat_group";

export type SourceType = "HEADER" | "LINE";

export type TransformationType =
  | "NONE"
  | "BEFORE_SLASH"
  | "AFTER_SLASH"
  | "REGEX"
  | "REGEX_REPLACE"
  | "TRIM"
  | "UPPERCASE"
  | "LOWERCASE";

export interface SAPFieldMapping {
  id?: number;
  module: VatModule;
  internal_field: InternalField;
  source_type: SourceType;
  priority: number;
  sap_field: string;
  transformation: TransformationType;
  transformation_value?: string | null;
  validation_regex?: string | null;
  description?: string | null;
  is_enabled: boolean;
}
