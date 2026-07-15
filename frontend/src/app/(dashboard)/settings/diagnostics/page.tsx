"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/lib/api";
import { DiagnosticsReport } from "@/types/settings";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/settings/diagnostics");
      if (!res.ok) {
        throw new Error("Failed to load System Doctor diagnostics.");
      }
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Unable to reach diagnostics service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  if (loading) {
    return (
      <SettingsLayout>
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-600">Running System Doctor Health Diagnostic...</span>
        </div>
      </SettingsLayout>
    );
  }

  if (error || !report) {
    return (
      <SettingsLayout>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <h3 className="font-semibold text-base">Diagnostics Error</h3>
          </div>
          <p className="text-sm">{error || "Unable to load diagnostics."}</p>
          <button
            onClick={loadDiagnostics}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Re-run Diagnostic
          </button>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout>
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                System Doctor Health Diagnostic Summary
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprehensive configuration integrity, SAP reachability, and tax coverage report.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadDiagnostics}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-test
              </button>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  report.readiness === "Ready"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : report.readiness === "Warning"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {report.readiness}
              </span>
            </div>
          </div>

          {/* Diagnostic Item List */}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {report.checks.map((check, idx) => (
              <div key={idx} className="p-4 bg-white hover:bg-slate-50 space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {check.status === "PASS" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {check.status === "WARN" && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                    {check.status === "FAIL" && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span className="text-sm font-semibold text-slate-900">{check.name}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                      {check.category}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      check.status === "PASS"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : check.status === "WARN"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 pl-6">{check.message}</p>
                {check.recommendation && (
                  <p className="text-xs text-blue-600 pl-6 font-medium">
                    Recommendation: {check.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
