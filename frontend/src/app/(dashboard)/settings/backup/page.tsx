"use client";

import { useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { ImportValidationSummary } from "@/types/settings";
import {
  Archive,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

export default function BackupRestorePage() {
  const [importJsonText, setImportJsonText] = useState("");
  const [previewSummary, setPreviewSummary] = useState<ImportValidationSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const res = await fetchWithAuth("/settings/export");
      if (!res.ok) throw new Error("Export failed.");
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kra_settings_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export settings: " + (err.message || "Error"));
    }
  };

  const handleDryRunPreview = async () => {
    setError(null);
    setPreviewSummary(null);
    setImportSuccess(false);
    if (!importJsonText.trim()) {
      setError("Please paste configuration JSON to preview.");
      return;
    }

    try {
      const payload = JSON.parse(importJsonText);
      const res = await fetchWithAuth("/settings/import?dry_run=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Validation failed.");
      }

      const summary: ImportValidationSummary = await res.json();
      setPreviewSummary(summary);
    } catch (err: any) {
      setError(err.message || "Invalid JSON or schema validation error.");
    }
  };

  const handleApplyImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const payload = JSON.parse(importJsonText);
      const res = await fetchWithAuth("/settings/import?dry_run=false", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Import failed.");
      }

      setImportSuccess(true);
      setPreviewSummary(null);
      setImportJsonText("");
    } catch (err: any) {
      setError(err.message || "Failed to apply imported settings.");
    } finally {
      setImporting(false);
    }
  };

  const handleRestoreDefaults = async (scope: "operational" | "tax" | "all") => {
    if (!confirm(`Are you sure you want to restore default configuration for '${scope}'?`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`/settings/restore?scope=${scope}`, { method: "POST" });
      if (!res.ok) throw new Error("Restore operation failed.");
      alert(`Default settings restored successfully for scope: ${scope}.`);
    } catch (err: any) {
      alert("Failed to restore defaults: " + err.message);
    }
  };

  return (
    <SettingsLayout>
      <div className="space-y-6">
        {/* Export Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Export System Configuration</h3>
              <p className="text-xs text-slate-500">
                Download a backup JSON payload of active reconciliation rules and tax master data.
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Configuration JSON
          </button>
        </div>

        {/* Dry Run Import Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Dry-Run Import Configuration</h3>
              <p className="text-xs text-slate-500">
                Paste a configuration JSON file to run schema validation and preview diffs before applying.
              </p>
            </div>
          </div>

          <textarea
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            rows={5}
            placeholder='Paste configuration JSON here... {"schema_version": 2, "application": "KRA Reconciliation System", ...}'
            className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {importSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Configuration imported and applied successfully!
            </div>
          )}

          {/* Diffs Preview */}
          {previewSummary && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Dry-Run Validation Diff Summary
              </h4>

              {previewSummary.diffs.length === 0 ? (
                <div className="text-xs text-slate-500">No differences detected. Configuration is identical.</div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded bg-white">
                  {previewSummary.diffs.map((d, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {d.entity} → {d.key}
                      </span>
                      <span className="text-slate-500">
                        <span className="text-rose-600 line-through mr-1">{d.old || "None"}</span> →{" "}
                        <span className="text-emerald-600 font-semibold">{d.new}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleApplyImport}
                disabled={importing}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                Apply Configuration Changes
              </button>
            </div>
          )}

          {!previewSummary && (
            <button
              onClick={handleDryRunPreview}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors flex items-center gap-2"
            >
              <FileUp className="w-4 h-4" /> Preview Changes (Dry Run)
            </button>
          )}
        </div>

        {/* Scoped Restore Defaults */}
        <div className="bg-white border border-rose-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 text-rose-900">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="text-base font-semibold">Restore Default Configuration</h3>
              <p className="text-xs text-slate-500">Reset configuration parameters to system default baseline.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleRestoreDefaults("operational")}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore Operational Rules
            </button>

            <button
              onClick={() => handleRestoreDefaults("tax")}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore Tax Master Data
            </button>

            <button
              onClick={() => handleRestoreDefaults("all")}
              className="px-3.5 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restore Everything to Default
            </button>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
