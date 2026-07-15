"use client";

import React, { useState } from "react";
import { WorkflowStep, AsyncStatus, WorkspaceUIState } from "../workspace/types";
import { DataTable, Column } from "@/components/DataTable";
import { Invoice } from "../types";
import { downloadTemplate } from "../api/exportApi";
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

interface PaginationData<T> {
  items: T[];
  totalItems: number | null;
}

interface WorkspaceViewProps {
  type: "sales" | "purchases";
  fromDate: string;
  setFromDate: (v: string) => void;
  toDate: string;
  setToDate: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uiState: WorkspaceUIState;
  handleLoadSap: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCompare: () => void;
  sapPagination: PaginationData<Invoice>;
  kraPagination: PaginationData<Invoice>;
  workflowStep: WorkflowStep;
  readyToCompare: boolean;
  warnings?: string[];
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

export function WorkspaceView({ 
  type, 
  fromDate, 
  setFromDate, 
  toDate, 
  setToDate, 
  fileInputRef,
  uiState,
  handleLoadSap,
  handleFileUpload,
  handleCompare,
  sapPagination,
  kraPagination,
  workflowStep,
  readyToCompare,
  warnings = []
}: WorkspaceViewProps) {
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    setLoadingTemplate(true);
    try {
      await downloadTemplate(type);
    } catch (err) {
      console.error("Template download failed", err);
      alert("Failed to download template. Please try again.");
    } finally {
      setLoadingTemplate(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
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
            <input type="file" accept=".csv" multiple ref={fileInputRef} onChange={handleFileUpload} disabled={uiState.sap.status !== AsyncStatus.Loaded || uiState.kra.status === AsyncStatus.Loading} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className={`px-5 py-2 rounded-md font-medium text-sm border transition-colors flex items-center gap-2 cursor-pointer h-[38px] ${uiState.sap.status !== AsyncStatus.Loaded ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
              {uiState.kra.status === AsyncStatus.Loading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uiState.kra.status === AsyncStatus.Loaded ? "Upload New CSVs" : "Upload CSVs"}
            </label>
            <button 
              onClick={handleDownloadTemplate} 
              disabled={loadingTemplate}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1.5 h-[38px] px-3 transition-colors"
            >
              {loadingTemplate ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
              Template
            </button>
          </div>
        </div>
      </section>

      {/* Contextual Workflow Stepper */}
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className={`flex items-center gap-1.5 ${workflowStep > WorkflowStep.LOAD_SAP ? "text-slate-900" : workflowStep === WorkflowStep.LOAD_SAP ? "text-blue-600" : ""}`}>
          {workflowStep > WorkflowStep.LOAD_SAP ? <CheckCircle2 className="w-4 h-4" /> : <div className="flex items-center justify-center w-5 h-5 rounded-full border border-current text-xs">1</div>}
          Load SAP
        </div>
        <div className="h-px bg-slate-300 w-8" />
        <div className={`flex items-center gap-1.5 ${workflowStep > WorkflowStep.UPLOAD_CSV ? "text-slate-900" : workflowStep === WorkflowStep.UPLOAD_CSV ? "text-blue-600" : ""}`}>
          {workflowStep > WorkflowStep.UPLOAD_CSV ? <CheckCircle2 className="w-4 h-4" /> : <div className="flex items-center justify-center w-5 h-5 rounded-full border border-current text-xs">2</div>}
          Upload CSV
        </div>
        <div className="h-px bg-slate-300 w-8" />
        <div className={`flex items-center gap-1.5 ${workflowStep >= WorkflowStep.COMPARE ? "text-slate-900" : workflowStep === WorkflowStep.COMPARE ? "text-blue-600" : ""}`}>
          {workflowStep > WorkflowStep.COMPARE ? <CheckCircle2 className="w-4 h-4" /> : <div className="flex items-center justify-center w-5 h-5 rounded-full border border-current text-xs">3</div>}
          Compare
        </div>
      </div>

      {/* Previews Panel - Fixed Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[750px]">
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
          {warnings && warnings.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-800 text-sm flex flex-col gap-1 shrink-0 animate-fade-in">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
                Upload Warnings
              </div>
              <ul className="list-disc pl-5 text-xs text-amber-700 space-y-0.5 max-h-24 overflow-y-auto">
                {warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex-1 overflow-hidden relative">
            <DataTable 
              data={kraPagination.items} 
              columns={invoiceColumns} 
              asyncState={uiState.kra}
              emptyState={
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="w-12 h-12 text-slate-300" strokeWidth={1.5} />
                  <div className="text-slate-500 text-sm">No CSVs uploaded. Upload KRA CSV files to begin.</div>
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

      {/* Compare Action */}
      <div className="flex justify-center mt-4">
        <button
          onClick={handleCompare}
          disabled={!readyToCompare || uiState.comparison.status === AsyncStatus.Loading}
          className="bg-blue-600 text-white px-10 py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md text-base flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
        >
          {uiState.comparison.status === AsyncStatus.Loading ? (
            <>
              <LoaderCircle className="w-5 h-5 animate-spin" />
              Comparing...
            </>
          ) : (
            "Compare & Reconcile"
          )}
        </button>
      </div>
    </div>
  );
}
