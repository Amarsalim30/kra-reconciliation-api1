export interface Invoice {
  pin: string;
  partner_name: string;
  invoice_number: string;
  invoice_date: string;
  cu_number: string;
  vat_group: string;
  base_amount: number;
  source: string;
}

export interface ReconciliationResult {
  cu_number: string;
  status: string;
  amount_match: boolean;
  vat_match: boolean;
  date_match: boolean;
  sap: Invoice | null;
  kra: Invoice | null;
}

export interface ReconciliationSummary {
  total_sap: number;
  total_kra: number;
  matches: number;
  mismatches: number;
  missing_in_sap: number;
  missing_in_kra: number;
}
