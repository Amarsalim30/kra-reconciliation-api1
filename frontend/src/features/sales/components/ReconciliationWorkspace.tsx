"use client";

import React, { useState } from "react";
import { useWorkspace } from "../workspace/useWorkspace";
import { SessionStatus } from "../workspace/types";
import { WorkspaceView } from "./WorkspaceView";
import { ReconciliationResultsView } from "./ReconciliationResultsView";
import { AlertTriangle } from "lucide-react";

interface ReconciliationWorkspaceProps {
  type: "sales" | "purchases";
}

type WorkspaceNavigationState = "workspace" | "results";

export function ReconciliationWorkspace({ type }: ReconciliationWorkspaceProps) {
  const [navState, setNavState] = useState<WorkspaceNavigationState>("workspace");

  const {
    fromDate, setFromDate, toDate, setToDate, fileStatuses, fileInputRef,
    uiState, summary, globalError, handleLoadSap, handleFileUpload, 
    handleCompare: triggerCompare,
    sapPagination, kraPagination, resultsPagination,
    workflowStep, sessionStatus, readyToCompare, sessionId
  } = useWorkspace(type);

  // We wrap handleCompare to also handle navigation to the Results view
  const handleCompareWithNavigation = async () => {
    await triggerCompare();
    // After comparison completes (either Success or Error), transition navigation view.
    // The underlying state model ensures data is retained.
    setNavState("results");
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
      {/* Shared Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight capitalize">
            {type} Reconciliation
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

      {navState === "workspace" ? (
        <WorkspaceView
          type={type}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          fileStatuses={fileStatuses}
          fileInputRef={fileInputRef}
          uiState={uiState}
          handleLoadSap={handleLoadSap}
          handleFileUpload={handleFileUpload}
          handleCompare={handleCompareWithNavigation}
          sapPagination={sapPagination}
          kraPagination={kraPagination}
          workflowStep={workflowStep}
          readyToCompare={readyToCompare}
        />
      ) : (
        <>
          {sessionId ? (
             <ReconciliationResultsView
               sessionId={sessionId}
               type={type}
               summary={summary}
               resultsPagination={resultsPagination}
               onBack={() => setNavState("workspace")}
             />
          ) : (
             <div className="bg-white p-10 text-center rounded-lg border border-slate-200 shadow-sm text-slate-500">
               <p>No active session found. Please return to the workspace and load data.</p>
               <button onClick={() => setNavState("workspace")} className="mt-4 text-blue-600 hover:text-blue-800 font-medium">Return to Workspace</button>
             </div>
          )}
        </>
      )}
    </div>
  );
}
