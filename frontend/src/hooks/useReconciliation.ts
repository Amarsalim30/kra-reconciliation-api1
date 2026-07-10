import { useState, useRef } from "react";
import { fetchWithAuth } from "@/lib/api";
import { SalesInvoice, ReconciliationResult, ReconciliationSummary } from "@/types";

export function useReconciliation() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fileName, setFileName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<"preview" | "results">("preview");
  const [sapInvoices, setSapInvoices] = useState<SalesInvoice[]>([]);
  const [kraInvoices, setKraInvoices] = useState<SalesInvoice[]>([]);
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);

  const [loadingSap, setLoadingSap] = useState(false);
  const [loadingKra, setLoadingKra] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadSap = async () => {
    if (!fromDate || !toDate) {
      setError("Please select both From and To dates.");
      return;
    }
    
    setLoadingSap(true);
    setCurrentView("preview");
    setError(null);
    setResults([]);
    setSummary(null);
    setKraInvoices([]);
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
      setSapInvoices(data.invoices || []);
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
    setCurrentView("preview");
    setError(null);
    setResults([]);
    setSummary(null);

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
      setKraInvoices(data.invoices || []);
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
      setResults(data.results);
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
    setSapInvoices([]);
    setKraInvoices([]);
    setResults([]);
    setSummary(null);
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
    sapInvoices,
    kraInvoices,
    results,
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
  };
}
