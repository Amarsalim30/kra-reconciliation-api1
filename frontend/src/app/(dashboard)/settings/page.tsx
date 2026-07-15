"use client";

import { useEffect, useState, useCallback } from "react";
import { SettingsComposite } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import { SAPConnectionCard } from "@/features/settings/SAPConnectionCard";
import { SystemSettingsCard } from "@/features/settings/SystemSettingsCard";
import { SAPFieldMappingCard } from "@/features/settings/SAPFieldMappingCard";
import { VATMappingEditor } from "@/features/settings/VATMappingEditor";
import { AuditLogDrawer } from "@/features/settings/AuditLogDrawer";
import {
  Server,
  Sliders,
  Tag,
  History,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  FileCode,
} from "lucide-react";


export default function SettingsPage() {
  const [data, setData] = useState<SettingsComposite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sap" | "system" | "sap_field_mapping" | "vat" | "audit">("sap");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/settings");
      if (!res.ok) {
        throw new Error("Failed to load enterprise settings parameters.");
      }
      const compositeData: SettingsComposite = await res.json();
      setData(compositeData);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve configuration settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-slate-600">Loading Enterprise Configuration...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-4 max-w-2xl mx-auto my-8">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <h3 className="font-semibold text-base">Configuration Loading Error</h3>
        </div>
        <p className="text-sm">{error || "Unable to reach settings endpoint."}</p>
        <button
          onClick={loadSettings}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full space-y-6 pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Enterprise Settings & Configuration
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage SAP infrastructure endpoints, reconciliation amount tolerances, canonical VAT tax codes, and audit logs.
          </p>
        </div>

        {data.is_using_env_fallback && (
          <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Active Mode: Default Environment Fallback (.env)
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("sap")}
          className={`px-4 py-2.5 rounded-t-lg font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "sap"
              ? "border-blue-600 text-blue-600 bg-blue-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Server className="w-4 h-4" />
          SAP Connection & Diagnostics
        </button>

        <button
          onClick={() => setActiveTab("system")}
          className={`px-4 py-2.5 rounded-t-lg font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "system"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Reconciliation Rules & Tolerances
        </button>

        <button
          onClick={() => setActiveTab("vat")}
          className={`px-4 py-2.5 rounded-t-lg font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "vat"
              ? "border-emerald-600 text-emerald-600 bg-emerald-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Tag className="w-4 h-4" />
          VAT Code Normalizer
        </button>

        <button
          onClick={() => setActiveTab("sap_field_mapping")}
          className={`px-4 py-2.5 rounded-t-lg font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "sap_field_mapping"
              ? "border-amber-600 text-amber-600 bg-amber-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <FileCode className="w-4 h-4" />
          SAP Field Mapping
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2.5 rounded-t-lg font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "audit"
              ? "border-sky-600 text-sky-600 bg-sky-50/50"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <History className="w-4 h-4" />
          Audit Change History
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-6">
        {activeTab === "sap" && (
          <SAPConnectionCard
            connection={data.sap_connection}
            isEnvFallback={data.is_using_env_fallback}
            onSaved={loadSettings}
          />
        )}

        {activeTab === "system" && (
          <SystemSettingsCard
            settings={data.system_settings}
            onSaved={loadSettings}
          />
        )}

        {activeTab === "vat" && (
          <VATMappingEditor
            connectionId={data.sap_connection?.id || null}
            mappings={data.vat_mappings}
            onSaved={loadSettings}
          />
        )}

        {activeTab === "sap_field_mapping" && (
          <SAPFieldMappingCard
            settingsVersion={data.system_settings.version}
            onSaved={loadSettings}
          />
        )}

        {activeTab === "audit" && <AuditLogDrawer />}
      </div>
    </div>
  );
}
