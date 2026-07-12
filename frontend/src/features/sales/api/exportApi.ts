import { fetchWithAuth } from "@/lib/api";

export async function exportReconciliationZip(
  type: "sales" | "purchases",
  sessionId: string
): Promise<void> {
  const res = await fetchWithAuth(
    `/reconciliation/${sessionId}/export?format=zip`
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Export failed");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Extract filename from Content-Disposition header
  const disposition = res.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
  a.download = filenameMatch?.[1] ?? `${type}_reconciliation.zip`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadTemplate(
  type: "sales" | "purchases"
): Promise<void> {
  const res = await fetchWithAuth(`/templates/${type}`);

  if (!res.ok) {
    throw new Error("Failed to download template");
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const disposition = res.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
  a.download = filenameMatch?.[1] ?? `kra_${type}_template.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

