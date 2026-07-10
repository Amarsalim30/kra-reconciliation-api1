"use client";

import { useReconciliation } from "../hooks/useReconciliation";
import { InvoiceTable } from "./InvoiceTable";
import { ResultsTable } from "./ResultsTable";
import { ArrowLeft } from "lucide-react";

interface ReconciliationWorkspaceProps {
  type: "sales" | "purchases";
}

export function ReconciliationWorkspace({ type }: ReconciliationWorkspaceProps) {
  const {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    fileName,
    fileInputRef,
    currentView,
    setCurrentView,
    summary,
    loadingSap,
    loadingKra,
    loadingCompare,
    error,
    handleLoadSap,
    handleFileUpload,
    handleCompare,
    sapPagination,
    kraPagination,
    resultsPagination,
  } = useReconciliation(type);

  const hasInvoices = sapPagination.items.length > 0;
  const hasKraInvoices = kraPagination.items.length > 0;
  const hasResults = resultsPagination.items.length > 0;

  const sapTitle = type === "sales" ? "SAP Sales Preview" : "SAP Purchases Preview";
  const kraTitle = type === "sales" ? "KRA Sales Preview" : "KRA Purchases Preview";

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto py-8 px-4">
      {/* Title Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight capitalize">
          {type} Reconciliation Workspace
        </h2>
        <p className="text-sm text-slate-500">
          Match and reconcile your SAP {type} invoices against the KRA portal CSV files.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm shadow-sm animate-shake">
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
            className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
          />
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To Date</label>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
          />
        </div>

        <button 
          onClick={handleLoadSap}
          disabled={loadingSap}
          className="bg-slate-900 text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 h-[38px]"
        >
          {loadingSap ? "Loading..." : "Load SAP"}
        </button>

        <div className="flex-1 min-w-[20px]"></div>

        <div className="flex flex-col gap-1.5 relative">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">KRA Data</label>
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={!hasInvoices || loadingKra}
              className="hidden"
              id="csv-upload"
            />
            <label 
              htmlFor="csv-upload"
              className={`px-5 py-2 rounded-md font-medium text-sm border transition-colors flex items-center justify-center cursor-pointer h-[38px]
                ${!hasInvoices ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}
              `}
            >
              {loadingKra ? "Uploading..." : "Upload KRA CSV"}
            </label>
            {fileName && <span className="text-sm text-slate-500 truncate max-w-[200px] font-mono">{fileName}</span>}
          </div>
        </div>
      </section>

      {/* Dynamic Display Area */}
      {loadingCompare ? (
        /* High-quality animated loader */
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 animate-pulse">
            Reconciling Invoices...
          </h3>
          <p className="text-sm text-slate-500 mt-2 max-w-sm text-center">
            Comparing document dates, base amounts, and VAT codes between SAP and KRA.
          </p>
        </div>
      ) : currentView === "results" && (hasResults || resultsPagination.isInitialLoading) ? (
        /* Results Table View */
        <section className="pb-16 flex flex-col gap-4">
          <div className="flex items-center">
            <button 
              onClick={() => setCurrentView("preview")}
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Previews
            </button>
          </div>
          <ResultsTable 
            results={resultsPagination.items} 
            summary={summary} 
            hasMore={resultsPagination.hasMore}
            isLoadingMore={resultsPagination.isLoadingMore || resultsPagination.isInitialLoading}
            onLoadMore={resultsPagination.loadNextPage}
          />
        </section>
      ) : (
        /* Previews & Compare View */
        <>
          {hasInvoices && (
            <section className={hasKraInvoices ? "grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in" : "flex flex-col animate-fade-in"}>
              <InvoiceTable 
                title={sapTitle} 
                data={sapPagination.items} 
                hasMore={sapPagination.hasMore}
                isLoadingMore={sapPagination.isLoadingMore}
                onLoadMore={sapPagination.loadNextPage}
              />
              
              {hasKraInvoices && (
                <InvoiceTable 
                  title={kraTitle} 
                  data={kraPagination.items} 
                  hasMore={kraPagination.hasMore}
                  isLoadingMore={kraPagination.isLoadingMore}
                  onLoadMore={kraPagination.loadNextPage}
                />
              )}
            </section>
          )}

          {hasInvoices && hasKraInvoices && (
            <div className="flex justify-center mt-4">
              <button
                onClick={handleCompare}
                className="bg-blue-600 text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-sm text-base transition-all active:scale-[0.98]"
              >
                Compare & Reconcile
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
