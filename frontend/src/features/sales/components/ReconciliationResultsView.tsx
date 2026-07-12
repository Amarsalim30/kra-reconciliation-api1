"use client";

import React, { useState } from "react";
import { ReconciliationResult, ReconciliationSummary } from "../types";
import { ResultsTable } from "./ResultsTable";
import { Download, ArrowLeft, AlertTriangle } from "lucide-react";
import { exportReconciliationZip } from "../api/exportApi";

interface ReconciliationResultsViewProps {
  sessionId: string;
  type: "sales" | "purchases";
  summary: ReconciliationSummary | null;
  resultsPagination: {
    items: ReconciliationResult[];
    hasMore: boolean;
    isLoadingMore: boolean;
    isInitialLoading: boolean;
    loadNextPage: () => void;
  };
  onBack: () => void;
}

export function ReconciliationResultsView({ 
  sessionId, 
  type, 
  summary, 
  resultsPagination, 
  onBack 
}: ReconciliationResultsViewProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await exportReconciliationZip(type, sessionId);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setExportError(err.message);
      } else {
        setExportError("Export failed");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="text-slate-600 hover:text-slate-900 text-sm font-semibold flex items-center gap-2 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workspace
          </button>
          <div className="h-4 w-px bg-slate-300"></div>
          <span className="text-sm font-medium text-slate-500">
            Completed {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-emerald-600 text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {exporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export ZIP
            </>
          )}
        </button>
      </div>

      {exportError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm shadow-sm flex items-center gap-2 animate-shake">
          <AlertTriangle className="w-4 h-4" />
          {exportError}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-1">
        <ResultsTable 
          results={resultsPagination.items} 
          summary={summary} 
          hasMore={resultsPagination.hasMore}
          isLoadingMore={resultsPagination.isLoadingMore || resultsPagination.isInitialLoading}
          onLoadMore={resultsPagination.loadNextPage}
        />
      </div>
    </div>
  );
}
