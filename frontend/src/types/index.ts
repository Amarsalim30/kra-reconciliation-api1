export interface SalesInvoice {
  pin: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  cu_number: string;
  vat_group: number;
  base_amount: number;
  source: string;
}

export interface ReconciliationResult {
  cu_number: string;
  status: string;
  amount_match: boolean;
  vat_match: boolean;
  date_match: boolean;
  sap: SalesInvoice | null;
  kra: SalesInvoice | null;
}

export interface ReconciliationSummary {
  total_sap: number;
  total_kra: number;
  matches: number;
  mismatches: number;
  missing_in_sap: number;
  missing_in_kra: number;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: T[];
}

