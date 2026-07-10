"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, removeToken } from "@/lib/api";
import { useReconciliation } from "@/hooks/useReconciliation";
import { InvoiceTable } from "@/components/InvoiceTable";
import { ResultsTable } from "@/components/ResultsTable";
import { LogOut } from "lucide-react";

export default function ReconciliationDashboard() {
  const router = useRouter();
  
  const {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    fileName,
    fileInputRef,
    sapInvoices,
    kraInvoices,
    results,
    summary,
    loadingSap,
    loadingKra,
    loadingCompare,
    error,
    handleLoadSap,
    handleFileUpload,
    handleCompare,
    resetState
  } = useReconciliation();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    removeToken();
    resetState();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
          KRA-SAP Reconciliation Bridge
        </h1>
        <button 
          onClick={handleLogout}
          className="text-slate-500 hover:text-slate-700 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 flex flex-col gap-8">
        
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Filters Section */}
        <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From Date</label>
            <input 
              type="date" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To Date</label>
            <input 
              type="date" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <button 
            onClick={handleLoadSap}
            disabled={loadingSap}
            className="bg-slate-900 text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {loadingSap ? "Loading..." : "Load SAP"}
          </button>

          <div className="flex-1"></div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">KRA Data</label>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={!sapInvoices.length || loadingKra}
                className="hidden"
                id="csv-upload"
              />
              <label 
                htmlFor="csv-upload"
                className={`px-5 py-2 rounded-md font-medium text-sm border transition-colors flex items-center justify-center cursor-pointer
                  ${!sapInvoices.length ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}
                `}
              >
                {loadingKra ? "Uploading..." : "Upload KRA CSV"}
              </label>
              {fileName && <span className="text-sm text-slate-500 truncate max-w-[200px]">{fileName}</span>}
            </div>
          </div>
        </section>

        {/* Previews */}
        {sapInvoices.length > 0 && (
          <section className="flex flex-col gap-8">
            <InvoiceTable title="SAP Sales Preview" data={sapInvoices} />
            
            {kraInvoices.length > 0 && (
              <InvoiceTable title="KRA Sales Preview" data={kraInvoices} />
            )}
          </section>
        )}

        {/* Compare Action */}
        {sapInvoices.length > 0 && kraInvoices.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={handleCompare}
              disabled={loadingCompare}
              className="bg-blue-600 text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 text-base"
            >
              {loadingCompare ? "Comparing..." : "Compare"}
            </button>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <section className="pb-16">
            <ResultsTable results={results} summary={summary} />
          </section>
        )}

      </main>
    </div>
  );
}
