import { useState, useRef, useCallback } from "react";
import { usePagination } from "@/hooks/usePagination";
import { Invoice, ReconciliationResult, ReconciliationSummary } from "../types";
import {
  fetchInvoicesPreview,
  uploadInvoicesCSV,
  compareInvoices,
  fetchInvoicesPage,
  fetchReconciliationResultsPage,
  FileUploadStatus
} from "../api/reconciliation";

export function useReconciliation(type: "sales" | "purchases") {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<"preview" | "results">("preview");

  const [loadingSap, setLoadingSap] = useState(false);
  const [loadingKra, setLoadingKra] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);

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
    enabled: currentView === "results" && !!sessionId,
  });

  const handleLoadSap = async () => {
    if (!fromDate || !toDate) {
      setError("Please select both From and To dates.");
      return;
    }
    
    setLoadingSap(true);
    setError(null);
    setSummary(null);
    sapPagination.reset();
    kraPagination.reset();
    resultsPagination.reset();
    setFileStatuses([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      const data = await fetchInvoicesPreview(type, fromDate, toDate);
      setSessionId(data.session_id);
      setCurrentView("preview");
      
      // Seed Page 1 of SAP preview directly
      const totalPages = Math.ceil(data.count / 100);
      sapPagination.reset(data.invoices, data.count, totalPages);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoadingSap(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!sessionId) {
      setError("Please load SAP data first to create a session.");
      return;
    }

    setLoadingKra(true);
    setError(null);
    setSummary(null);
    setFileStatuses([]);
    kraPagination.reset();
    resultsPagination.reset();

    try {
      const data = await uploadInvoicesCSV(type, sessionId, files);
      setFileStatuses(data.files);
      setCurrentView("preview");
      
      // Seed Page 1 of KRA preview directly
      const totalParsed = data.files.reduce((sum, f) => sum + f.parsed, 0);
      const totalPages = Math.ceil(totalParsed / 100);
      kraPagination.reset(data.invoices, totalParsed, totalPages);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setLoadingKra(false);
    }
  };

  const handleCompare = async () => {
    if (!sessionId) return;
    
    setLoadingCompare(true);
    setError(null);
    resultsPagination.reset();

    try {
      const data = await compareInvoices(sessionId);
      setSummary(data.summary);
      setCurrentView("results");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoadingCompare(false);
    }
  };

  const resetState = () => {
    setSessionId(null);
    setCurrentView("preview");
    setSummary(null);
    setFileStatuses([]);
    sapPagination.reset();
    kraPagination.reset();
    resultsPagination.reset();
    setFromDate("");
    setToDate("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    fileStatuses,
    fileInputRef,
    sessionId,
    currentView,
    setCurrentView,
    summary,
    loadingSap,
    loadingKra,
    loadingCompare,
    error,
    setError,
    handleLoadSap,
    handleFileUpload,
    handleCompare,
    resetState,
    sapPagination,
    kraPagination,
    resultsPagination,
  };
}
