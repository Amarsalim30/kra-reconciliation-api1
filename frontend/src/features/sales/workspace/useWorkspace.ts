import { useState, useRef, useCallback } from "react";
import { usePagination } from "@/hooks/usePagination";
import { Invoice, ReconciliationResult, ReconciliationSummary } from "../types";
import {
  fetchInvoicesPreview,
  uploadInvoicesCSV,
  compareInvoices,
  fetchInvoicesPage,
  fetchReconciliationResultsPage
} from "../api/reconciliation";
import { AsyncStatus, WorkspaceUIState } from "./types";
import { getWorkflowStep, getSessionStatus, isReadyToCompare, getMetrics } from "./selectors";

export function useWorkspace(type: "sales" | "purchases") {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fileName, setFileName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // UI State single source of truth
  const [uiState, setUiState] = useState<WorkspaceUIState>({
    sap: { status: AsyncStatus.Idle },
    kra: { status: AsyncStatus.Idle },
    comparison: { status: AsyncStatus.Idle }
  });

  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Paginated Fetchers
  const fetchSapPage = useCallback((page: number, limit: number) => {
    if (!sessionId) return Promise.reject("No active session");
    return fetchInvoicesPage(sessionId, "SAP", page, limit);
  }, [sessionId]);

  const fetchKraPage = useCallback((page: number, limit: number) => {
    if (!sessionId) return Promise.reject("No active session");
    return fetchInvoicesPage(sessionId, "KRA", page, limit);
  }, [sessionId]);

  const fetchResultsPage = useCallback((page: number, limit: number) => {
    if (!sessionId) return Promise.reject("No active session");
    return fetchReconciliationResultsPage(sessionId, page, limit);
  }, [sessionId]);

  // Hook Instantiations
  const sapPagination = usePagination<Invoice>(fetchSapPage, { limit: 100, enabled: false });
  const kraPagination = usePagination<Invoice>(fetchKraPage, { limit: 100, enabled: false });
  const resultsPagination = usePagination<ReconciliationResult>(fetchResultsPage, {
    limit: 100,
    enabled: uiState.comparison.status === AsyncStatus.Loaded && !!sessionId,
  });

  const handleLoadSap = async () => {
    if (!fromDate || !toDate) {
      setGlobalError("Please select both From and To dates.");
      return;
    }
    
    setUiState(prev => ({
      ...prev,
      sap: { status: AsyncStatus.Loading },
      kra: { status: AsyncStatus.Idle },
      comparison: { status: AsyncStatus.Idle }
    }));
    setGlobalError(null);
    setSummary(null);
    sapPagination.reset();
    kraPagination.reset();
    resultsPagination.reset();
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      const data = await fetchInvoicesPreview(type, fromDate, toDate);
      setSessionId(data.session_id);
      
      const totalPages = Math.ceil(data.count / 100);
      sapPagination.reset(data.invoices, data.count, totalPages);
      
      setUiState(prev => ({ ...prev, sap: { status: AsyncStatus.Loaded } }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred loading SAP data.";
      setUiState(prev => ({ ...prev, sap: { status: AsyncStatus.Error, error: errorMessage } }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!sessionId) {
      setGlobalError("Please load SAP data first to create a session.");
      return;
    }

    setFileName(file.name);
    setUiState(prev => ({
      ...prev,
      kra: { status: AsyncStatus.Loading },
      comparison: { status: AsyncStatus.Idle }
    }));
    setGlobalError(null);
    setSummary(null);
    kraPagination.reset();
    resultsPagination.reset();

    try {
      const data = await uploadInvoicesCSV(type, sessionId, file);
      
      const totalPages = Math.ceil(data.parsed / 100);
      kraPagination.reset(data.invoices, data.parsed, totalPages);
      
      setUiState(prev => ({ ...prev, kra: { status: AsyncStatus.Loaded } }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred uploading CSV.";
      setUiState(prev => ({ ...prev, kra: { status: AsyncStatus.Error, error: errorMessage } }));
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCompare = async () => {
    if (!sessionId) return;
    
    setUiState(prev => ({ ...prev, comparison: { status: AsyncStatus.Loading } }));
    setGlobalError(null);
    resultsPagination.reset();

    try {
      const data = await compareInvoices(sessionId);
      setSummary(data.summary);
      
      // We don't seed results directly here, the pagination hook will fetch page 1 automatically when enabled.
      // But we can reset it to trigger the fetch if needed, or if the API returned it, seed it.
      // Assuming the API just returns summary and we need to fetch results.
      
      setUiState(prev => ({ ...prev, comparison: { status: AsyncStatus.Loaded } }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during comparison.";
      setUiState(prev => ({ ...prev, comparison: { status: AsyncStatus.Error, error: errorMessage } }));
    }
  };

  const resetState = () => {
    setSessionId(null);
    setUiState({
      sap: { status: AsyncStatus.Idle },
      kra: { status: AsyncStatus.Idle },
      comparison: { status: AsyncStatus.Idle }
    });
    setSummary(null);
    sapPagination.reset();
    kraPagination.reset();
    resultsPagination.reset();
    setFileName("");
    setFromDate("");
    setToDate("");
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Derived Values
  const workflowStep = getWorkflowStep(uiState);
  const sessionStatus = getSessionStatus(uiState);
  const readyToCompare = isReadyToCompare(uiState);
  const metrics = getMetrics(
    uiState, 
    sapPagination.totalItems || 0, 
    kraPagination.totalItems || 0,
    summary?.matches,
    summary?.mismatches
  );

  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    fileName,
    fileInputRef,
    sessionId,
    uiState,
    summary,
    globalError,
    setGlobalError,
    handleLoadSap,
    handleFileUpload,
    handleCompare,
    resetState,
    sapPagination,
    kraPagination,
    resultsPagination,
    
    // Derived UI states
    workflowStep,
    sessionStatus,
    readyToCompare,
    metrics
  };
}
