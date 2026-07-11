"use client";

import React from "react";
import { useWorkspace } from "../workspace/useWorkspace";
import { WorkflowStep, SessionStatus, AsyncStatus } from "../workspace/types";
import { DataTable, Column } from "@/components/DataTable";
import { Invoice } from "../types";
import { ResultsTable } from "./ResultsTable";
import { 
  Database, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  LoaderCircle, 
  RefreshCw, 
  Upload, 
  Download,
  FileText
} from "lucide-react";

interface ReconciliationWorkspaceProps {
  type: "sales" | "purchases";
}

const formatVatGroup = (vat?: string) => {
  if (!vat) return "";
  const value = vat.trim();
  return /^\d+(\.\d+)?$/.test(value) ? `${value}%` : value;
};

// Reusable Columns for SAP and KRA previews
const invoiceColumns: Column<Invoice>[] = [
  { key: "pin", header: "PIN", accessor: (inv) => <span className="font-mono">{inv.pin || "-"}</span>, skeletonWidth: "w-20" },
  { key: "invNo", header: "Invoice No", accessor: (inv) => <span className="font-mono">{inv.invoice_number}</span>, skeletonWidth: "w-24" },
  { key: "partner", header: "Partner Name", accessor: (inv) => <span className="truncate max-w-[200px] block" title={inv.partner_name}>{inv.partner_name}</span>, skeletonWidth: "w-32" },
  { key: "date", header: "Invoice Date", accessor: (inv) => inv.invoice_date, skeletonWidth: "w-20" },
  { key: "cu", header: "CU Number", accessor: (inv) => <span className="font-mono">{inv.cu_number}</span>, skeletonWidth: "w-32" },
  { key: "base", header: "Base Amount", className: "text-right", accessor: (inv) => <span className="font-mono">{inv.base_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>, skeletonWidth: "w-20" },
  { key: "vat", header: "VAT Group", className: "text-right", accessor: (inv) => formatVatGroup(inv.vat_group), skeletonWidth: "w-12" }
];

export function ReconciliationWorkspace({ type }: ReconciliationWorkspaceProps) {
  const {
    fromDate, setFromDate, toDate, setToDate, fileInputRef,
    uiState, summary, globalError, handleLoadSap, handleFileUpload, handleCompare,
    sapPagination, kraPagination, resultsPagination,
    workflowStep, sessionStatus, readyToCompare, metrics
  } = useWorkspace(type);

  const getMetricIcon = (iconName?: string) => {
    switch (iconName) {
      case "Database": return <Database className="w-5 h-5 text-blue-500" />;
      case "FileSpreadsheet": return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
      case "CheckCircle2": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "AlertTriangle": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return null;
    }
  };

  const getSessionStatusLabel = (status: SessionStatus) => {
    switch (status) {
      case SessionStatus.WaitingForSAP: return "Waiting for SAP";
      case SessionStatus.LoadingSAP: return "Loading SAP invoices";
      case SessionStatus.WaitingForCSV: return "Ready for CSV upload";
      case SessionStatus.ReadyToCompare: return "Ready to compare";
      case SessionStatus.Comparing: return "Comparing";
      case SessionStatus.Completed: return "Completed";
      case SessionStatus.Error: return "Error occurred";
      default: return "";
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-20">
      {/* Header & Session Status */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight capitalize">
            {type} Reconciliation Workspace
          </h2>
          <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border border-slate-200">
            <div className={`w-2 h-2 rounded-full ${sessionStatus === SessionStatus.Completed ? "bg-green-500" : sessionStatus === SessionStatus.Error ? "bg-red-500" : "bg-blue-500 animate-pulse"}`} />
            Session: {getSessionStatusLabel(sessionStatus)}
          </div>
        </div>
      </div>

      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm shadow-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {globalError}
        </div>
      )}

      {/* Controls */}
      <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-6 items-end relative z-20">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors" />
        </div>
        <button onClick={handleLoadSap} disabled={uiState.sap.status === AsyncStatus.Loading} className="bg-slate-900 text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 h-[38px] flex items-center gap-2">
          {uiState.sap.status === AsyncStatus.Loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
          {uiState.sap.status === AsyncStatus.Loaded ? "Reload SAP" : "Load SAP"}
        </button>

        <div className="flex-1 min-w-[20px]"></div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">KRA Data</label>
          <div className="flex items-center gap-3">
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} disabled={uiState.sap.status !== AsyncStatus.Loaded || uiState.kra.status === AsyncStatus.Loading} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className={`px-5 py-2 rounded-md font-medium text-sm border transition-colors flex items-center gap-2 cursor-pointer h-[38px] ${uiState.sap.status !== AsyncStatus.Loaded ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
              {uiState.kra.status === AsyncStatus.Loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uiState.kra.status === AsyncStatus.Loaded ? "Upload New CSV" : "Upload CSV"}
            </label>
            <a href={`/api/v1/templates/${type}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 h-[38px] px-3 transition-colors">
              <Download className="w-4 h-4" /> Template
            </a>
          </div>
        </div>
      </section>

      {/* Workflow Stepper */}
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className={`flex items-center gap-1.5 ${workflowStep > WorkflowStep.LOAD_SAP ? "text-slate-900" : workflowStep === WorkflowStep.LOAD_SAP ? "text-blue-600" : ""}`}>
          {workflowStep > WorkflowStep.LOAD_SAP ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
          Load SAP
        </div>
        <div className="h-px bg-slate-300 w-8" />
        <div className={`flex items-center gap-1.5 ${workflowStep > WorkflowStep.UPLOAD_CSV ? "text-slate-900" : workflowStep === WorkflowStep.UPLOAD_CSV ? "text-blue-600" : ""}`}>
          {workflowStep > WorkflowStep.UPLOAD_CSV ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
          Upload CSV
        </div>
        <div className="h-px bg-slate-300 w-8" />
        <div className={`flex items-center gap-1.5 ${workflowStep > WorkflowStep.COMPARE ? "text-slate-900" : workflowStep === WorkflowStep.COMPARE ? "text-blue-600" : ""}`}>
          {workflowStep > WorkflowStep.COMPARE ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
          Compare
        </div>
        <div className="h-px bg-slate-300 w-8" />
        <div className={`flex items-center gap-1.5 ${workflowStep > WorkflowStep.EXPORT ? "text-slate-900" : workflowStep === WorkflowStep.EXPORT ? "text-blue-600" : ""}`}>
          {workflowStep > WorkflowStep.EXPORT ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
          Export
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">{m.title}</span>
              {getMetricIcon(m.icon)}
            </div>
            <div className="text-2xl font-bold text-slate-800">{m.value}</div>
            <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide">{m.subtitle}</div>
          </div>
        ))}
      </div>

      {/* Previews Panel - Fixed Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[500px]">
        {/* SAP Panel */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden h-full">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-500" />
              SAP Data Preview
            </h3>
            {uiState.sap.status === AsyncStatus.Loaded && (
              <span className="text-xs text-slate-500 font-medium">{sapPagination.totalItems} invoices</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden relative">
            <DataTable 
              data={sapPagination.items} 
              columns={invoiceColumns} 
              asyncState={uiState.sap}
              emptyState={
                <div className="flex flex-col items-center gap-3">
                  <FileText className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
                  <div className="text-slate-500 text-sm">No SAP invoices loaded. Select dates and Load SAP.</div>
                </div>
              }
              errorState={
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="w-12 h-12 text-red-400" strokeWidth={1.5} />
                  <div className="text-red-600 text-sm font-medium">Failed to load SAP invoices.</div>
                  <button onClick={handleLoadSap} className="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
                </div>
              }
            />
          </div>
        </div>

        {/* KRA Panel */}
        <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden h-full">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              KRA CSV Preview
            </h3>
            {uiState.kra.status === AsyncStatus.Loaded && (
              <span className="text-xs text-slate-500 font-medium">{kraPagination.totalItems} records</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden relative">
            <DataTable 
              data={kraPagination.items} 
              columns={invoiceColumns} 
              asyncState={uiState.kra}
              emptyState={
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
                  <div className="text-slate-500 text-sm">No CSV uploaded. Upload a KRA CSV to begin.</div>
                </div>
              }
              errorState={
                <div className="flex flex-col items-center gap-3">
                  <AlertTriangle className="w-12 h-12 text-red-400" strokeWidth={1.5} />
                  <div className="text-red-600 text-sm font-medium">Failed to parse KRA CSV.</div>
                </div>
              }
            />
          </div>
        </div>
      </div>

      {/* Comparison Area (Permanent Section) */}
      <div className="flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm p-6 gap-6 mt-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Comparison Results</h3>
            <p className="text-sm text-slate-500 mt-1">
              Match logic executes securely on the backend. Results will appear below.
            </p>
          </div>
          <button
            onClick={handleCompare}
            disabled={!readyToCompare || uiState.comparison.status === AsyncStatus.Loading}
            className="bg-blue-600 text-white px-8 py-2.5 rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-sm text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uiState.comparison.status === AsyncStatus.Loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
            Compare Invoices
          </button>
        </div>

        {uiState.comparison.status === AsyncStatus.Loading && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <LoaderCircle className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <h4 className="font-medium text-slate-800">Reconciling datasets...</h4>
            <p className="text-sm text-slate-500 mt-1">Please wait while the matching algorithm runs.</p>
          </div>
        )}

        {uiState.comparison.status === AsyncStatus.Error && (
          <div className="bg-red-50 p-4 rounded-md text-red-700 text-sm border border-red-200 flex items-center gap-3 animate-fade-in">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <div className="font-semibold">Comparison Failed</div>
              <div className="mt-1">{uiState.comparison.error || "An unknown error occurred."}</div>
            </div>
            <button onClick={handleCompare} className="ml-auto bg-white px-3 py-1.5 rounded border border-red-200 hover:bg-red-50 font-medium">Retry</button>
          </div>
        )}

        {uiState.comparison.status === AsyncStatus.Idle && !readyToCompare && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="text-sm font-medium">Waiting for SAP and KRA data to be loaded...</div>
          </div>
        )}

        {(uiState.comparison.status === AsyncStatus.Loaded || resultsPagination.items.length > 0) && (
          <div className="animate-fade-in">
            <ResultsTable 
              results={resultsPagination.items} 
              summary={summary} 
              hasMore={resultsPagination.hasMore}
              isLoadingMore={resultsPagination.isLoadingMore || resultsPagination.isInitialLoading}
              onLoadMore={resultsPagination.loadNextPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
