import { useState, useRef, useCallback } from "react";
import { fetchWithAuth } from "@/lib/api";
import { SalesInvoice, ReconciliationResult, ReconciliationSummary } from "@/types";
import { usePagination } from "@/hooks/usePagination";

export function useReconciliation() {
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
  const fetchInvoicesPage = useCallback(async (source: "SAP" | "KRA", page: number, limit: number) => {
    if (!sessionId) throw new Error("No active session");
    const res = await fetchWithAuth(`/sessions/${sessionId}/invoices?source=${source}&page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch invoices");
    return res.json();
  }, [sessionId]);

  const fetchSapPage = useCallback((page: number, limit: number) => 
    fetchInvoicesPage("SAP", page, limit), 
    [fetchInvoicesPage]
  );

  const fetchKraPage = useCallback((page: number, limit: number) => 
    fetchInvoicesPage("KRA", page, limit), 
    [fetchInvoicesPage]
  );

  const fetchResultsPage = useCallback(async (page: number, limit: number) => {
    if (!sessionId) throw new Error("No active session");
    const res = await fetchWithAuth(`/sessions/${sessionId}/results?page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch reconciliation results");
    return res.json();
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
      const res = await fetchWithAuth(`/sales?from=${fromDate}&to=${toDate}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to load SAP data");
      }
      
      const data = await res.json();
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetchWithAuth(`/sales/upload?session_id=${sessionId}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to upload KRA CSV");
      }

      const data = await res.json();
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
      const res = await fetchWithAuth(`/reconciliation/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Reconciliation failed");
      }

      const data = await res.json();
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
