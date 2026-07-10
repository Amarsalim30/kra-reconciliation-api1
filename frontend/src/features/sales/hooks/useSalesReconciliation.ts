import { useState, useRef, useCallback } from "react";
import { usePagination } from "@/hooks/usePagination";
import { SalesInvoice, ReconciliationResult, ReconciliationSummary } from "../types";
import {
  fetchSalesPreview,
  uploadSalesCSV,
  compareSales,
  fetchSalesInvoicesPage,
  fetchReconciliationResultsPage
} from "../api/reconciliation";

export function useSalesReconciliation() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fileName, setFileName] = useState("");
  
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
    return fetchSalesInvoicesPage(sessionId, "SAP", page, limit);
  }, [sessionId]);

  const fetchKraPage = useCallback((page: number, limit: number) => {
    if (!sessionId) return Promise.reject("No active session");
    return fetchSalesInvoicesPage(sessionId, "KRA", page, limit);
  }, [sessionId]);

  const fetchResultsPage = useCallback((page: number, limit: number) => {
    if (!sessionId) return Promise.reject("No active session");
    return fetchReconciliationResultsPage(sessionId, page, limit);
  }, [sessionId]);

  // Hook Instantiations
  const sapPagination = usePagination<SalesInvoice>(fetchSapPage, { limit: 100, enabled: false });
  const kraPagination = usePagination<SalesInvoice>(fetchKraPage, { limit: 100, enabled: false });
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
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      const data = await fetchSalesPreview(fromDate, toDate);
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
    const file = e.target.files?.[0];
    if (!file) return;
    if (!sessionId) {
      setError("Please load SAP data first to create a session.");
      return;
    }

    setFileName(file.name);
    setLoadingKra(true);
    setError(null);
    setSummary(null);
    kraPagination.reset();
    resultsPagination.reset();

    try {
      const data = await uploadSalesCSV(sessionId, file);
      setCurrentView("preview");
      
      // Seed Page 1 of KRA preview directly
      const totalPages = Math.ceil(data.parsed / 100);
      kraPagination.reset(data.invoices, data.parsed, totalPages);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
      setFileName("");
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
      const data = await compareSales(sessionId);
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
    sapPagination.reset();
    kraPagination.reset();
    resultsPagination.reset();
    setFileName("");
    setFromDate("");
    setToDate("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    fileName,
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
