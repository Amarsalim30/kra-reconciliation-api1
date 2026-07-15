"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";
import { SettingsComposite, DiagnosticsReport } from "@/types/settings";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  Loader2,
  RefreshCw,
  Server,
  Sliders,
  Tag,
  XCircle,
} from "lucide-react";

export default function SettingsDashboardPage() {
  const [composite, setComposite] = useState<SettingsComposite | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [compRes, diagRes] = await Promise.all([
        fetchWithAuth("/settings"),
        fetchWithAuth("/settings/diagnostics"),
      ]);

      if (!compRes.ok || !diagRes.ok) {
        throw new Error("Failed to load settings composite or diagnostics.");
      }

      const compData = await compRes.json();
      const diagData = await diagRes.json();

      setComposite(compData);
      setDiagnostics(diagData);
    } catch (err: any) {
      setError(err.message || "Unable to reach settings endpoint.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SettingsLayout>
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-slate-600">Loading System Doctor & Overview...</span>
        </div>
      </SettingsLayout>
    );
  }

  if (error || !composite || !diagnostics) {
    return (
      <SettingsLayout>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <h3 className="font-semibold text-base">Settings Unavailable</h3>
          </div>
          <p className="text-sm">{error || "Failed to retrieve system overview."}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </SettingsLayout>
    );
  }

  const statusBadge = (readiness: string) => {
    if (readiness === "Ready") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> System Ready
        </span>
      );
    }
    if (readiness === "Warning") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-600" /> Review Warnings
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-xs font-semibold">
        <XCircle className="w-4 h-4 text-rose-600" /> Action Required
      </span>
    );
  };

  return (
    <SettingsLayout>
      <div className="space-y-6">
        {/* System Health Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                System Doctor Readiness State
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates system connectivity, VAT code mappings, and matching thresholds.
              </p>
            </div>
            {statusBadge(diagnostics.readiness)}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="text-xs font-medium text-slate-500">SAP Connection</div>
              <div className="text-base font-bold text-slate-900 truncate">
                {composite.sap_connection ? composite.sap_connection.name : "Environment Fallback"}
              </div>
              <div className="text-xs text-slate-400">
                {composite.sap_connection ? composite.sap_connection.base_url : ".env configuration active"}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="text-xs font-medium text-slate-500">Tax Code Mapped Coverage</div>
              <div className="text-base font-bold text-emerald-600">
                {composite.tax_configuration.coverage.total} Mapped Codes
              </div>
              <div className="text-xs text-slate-400">
                {composite.tax_configuration.coverage.purchases} Purchases / {composite.tax_configuration.coverage.sales} Sales
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="text-xs font-medium text-slate-500">Amount Variance Tolerance</div>
              <div className="text-base font-bold text-indigo-600">
                KES {parseFloat(composite.system_settings.amount_tolerance).toFixed(2)}
              </div>
              <div className="text-xs text-slate-400">
                Date tolerance: ±{composite.system_settings.date_tolerance} days
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Checks Checklist */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Health Diagnostics Checklist</h3>
            <Link
              href="/settings/diagnostics"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View Full Report <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {diagnostics.checks.slice(0, 4).map((check, i) => (
              <div key={i} className="p-3.5 flex items-start justify-between gap-4 bg-white hover:bg-slate-50">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-slate-800">{check.name}</div>
                  <div className="text-xs text-slate-500">{check.message}</div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
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
            ))}
          </div>
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/settings/connection"
            className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-blue-500 hover:shadow-sm transition-all flex items-start gap-4"
          >
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900 text-sm">SAP Connection Settings</h4>
              <p className="text-xs text-slate-500">
                Configure SAP Service Layer credentials, SSL verification, and test connectivity.
              </p>
            </div>
          </Link>

          <Link
            href="/settings/tax"
            className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-emerald-500 hover:shadow-sm transition-all flex items-start gap-4"
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-900 text-sm">Tax Master Data & Mappings</h4>
              <p className="text-xs text-slate-500">
                Map customer SAP tax codes to canonical KRA VAT buckets with coverage indicators.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </SettingsLayout>
  );
}
