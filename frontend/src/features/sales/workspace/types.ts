export enum AsyncStatus {
  Idle = "Idle",
  Loading = "Loading",
  Loaded = "Loaded",
  Error = "Error",
  Empty = "Empty"
}

export type AsyncState = {
  status: AsyncStatus;
  error?: string;
  emptyReason?: "SAP" | "KRA";
};

export type WorkspaceUIState = {
  sap: AsyncState;
  kra: AsyncState;
  comparison: AsyncState;
};

export enum WorkflowStep {
  LOAD_SAP = "LOAD_SAP",
  UPLOAD_CSV = "UPLOAD_CSV",
  COMPARE = "COMPARE",
  EXPORT = "EXPORT"
}

export enum SessionStatus {
  WaitingForSAP = "WaitingForSAP",
  LoadingSAP = "LoadingSAP",
  WaitingForCSV = "WaitingForCSV",
  ReadyToCompare = "ReadyToCompare",
  Comparing = "Comparing",
  Completed = "Completed",
  Error = "Error"
}

export interface Metric {
  id: string;
  title: string;
  value: string | number;
  subtitle: string;
  icon?: string;
}
