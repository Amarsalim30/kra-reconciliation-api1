import { fetchWithAuth } from "@/lib/api";
import { SalesInvoice, ReconciliationResult, ReconciliationSummary } from "../types";
import { PaginatedResponse } from "@/types";

export interface SalesFetchResponse {
  session_id: string;
  source: string;
  count: number;
  from_date: string;
  to_date: string;
  invoices: SalesInvoice[];
}

export interface CSVValidationErrorDetail {
  row: number;
  column: string | null;
  message: string;
}

export interface SalesUploadResponse {
  session_id: string;
  filename: string;
  rows: number;
  parsed: number;
  errors_count: number;
  errors: CSVValidationErrorDetail[];
  invoices: SalesInvoice[];
}

export interface ReconciliationResponse {
  session_id: string;
  summary: ReconciliationSummary;
}

export async function fetchSalesPreview(fromDate: string, toDate: string): Promise<SalesFetchResponse> {
  const res = await fetchWithAuth(`/sales?from=${fromDate}&to=${toDate}`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to load SAP data");
  }
  return res.json();
}

export async function uploadSalesCSV(sessionId: string, file: File): Promise<SalesUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetchWithAuth(`/sales/upload?session_id=${sessionId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to upload KRA CSV");
  }
  return res.json();
}

export async function compareSales(sessionId: string): Promise<ReconciliationResponse> {
  const res = await fetchWithAuth(`/reconciliation/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Reconciliation failed");
  }
  return res.json();
}

export async function fetchSalesInvoicesPage(
  sessionId: string,
  source: "SAP" | "KRA",
  page: number,
  limit: number
): Promise<PaginatedResponse<SalesInvoice>> {
  const res = await fetchWithAuth(`/sessions/${sessionId}/invoices?source=${source}&page=${page}&limit=${limit}`);
  if (!res.ok) {
    throw new Error("Failed to fetch invoices");
  }
  return res.json();
}

export async function fetchReconciliationResultsPage(
  sessionId: string,
  page: number,
  limit: number
): Promise<PaginatedResponse<ReconciliationResult>> {
  const res = await fetchWithAuth(`/sessions/${sessionId}/results?page=${page}&limit=${limit}`);
  if (!res.ok) {
    throw new Error("Failed to fetch reconciliation results");
  }
  return res.json();
}
