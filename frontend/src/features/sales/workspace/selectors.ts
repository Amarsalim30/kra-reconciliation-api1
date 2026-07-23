import { WorkspaceUIState, WorkflowStep, SessionStatus, AsyncStatus, Metric } from "./types";

export function getWorkflowStep(state: WorkspaceUIState): WorkflowStep {
  if (state.comparison.status === AsyncStatus.Loaded) {
    return WorkflowStep.EXPORT;
  }
  if (state.kra.status === AsyncStatus.Loaded) {
    return WorkflowStep.COMPARE;
  }
  if (state.sap.status === AsyncStatus.Loaded) {
    return WorkflowStep.UPLOAD_CSV;
  }
  return WorkflowStep.LOAD_SAP;
}

export function getSessionStatus(state: WorkspaceUIState): SessionStatus {
  if (state.sap.status === AsyncStatus.Error || state.kra.status === AsyncStatus.Error || state.comparison.status === AsyncStatus.Error) {
    return SessionStatus.Error;
  }
  
  if (state.comparison.status === AsyncStatus.Loaded) {
    return SessionStatus.Completed;
  }
  
  if (state.comparison.status === AsyncStatus.Loading) {
    return SessionStatus.Comparing;
  }
  
  if (state.kra.status === AsyncStatus.Loaded) {
    return SessionStatus.ReadyToCompare;
  }
  
  if (state.sap.status === AsyncStatus.Loaded) {
    return SessionStatus.WaitingForCSV;
  }
  
  if (state.sap.status === AsyncStatus.Loading) {
    return SessionStatus.LoadingSAP;
  }

  return SessionStatus.WaitingForSAP;
}

export function isReadyToCompare(state: WorkspaceUIState): boolean {
  return state.sap.status === AsyncStatus.Loaded && state.kra.status === AsyncStatus.Loaded && state.comparison.status !== AsyncStatus.Loading;
}

export function getMetrics(state: WorkspaceUIState, sapCount: number, kraCount: number, matchesCount?: number, differencesCount?: number): Metric[] {
  return [
    {
      id: "sap_invoices",
      title: "SAP Invoices",
      value: state.sap.status === AsyncStatus.Loaded ? sapCount : 0,
      subtitle: state.sap.status === AsyncStatus.Loaded ? "Loaded" : "Not Loaded",
      icon: "Database"
    },
    {
      id: "kra_records",
      title: "KRA Records",
      value: state.kra.status === AsyncStatus.Loaded ? kraCount : 0,
      subtitle: state.kra.status === AsyncStatus.Loaded ? "Uploaded" : "No File",
      icon: "FileSpreadsheet"
    },
    {
      id: "matches",
      title: "Matches",
      value: state.comparison.status === AsyncStatus.Loaded && matchesCount !== undefined ? matchesCount : "—",
      subtitle: state.comparison.status === AsyncStatus.Loaded ? "Matched" : "Compare Required",
      icon: "CheckCircle2"
    },
    {
      id: "differences",
      title: "Differences",
      value: state.comparison.status === AsyncStatus.Loaded && differencesCount !== undefined ? differencesCount : "—",
      subtitle: state.comparison.status === AsyncStatus.Loaded ? "Identified" : "Compare Required",
      icon: "AlertTriangle"
    }
  ];
}
