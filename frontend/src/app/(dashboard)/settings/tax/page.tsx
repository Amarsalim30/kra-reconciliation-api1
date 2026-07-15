"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/lib/api";
import { SettingsComposite } from "@/types/settings";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { VATMappingEditor } from "@/features/settings/VATMappingEditor";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export default function TaxConfigurationPage() {
  const [composite, setComposite] = useState<SettingsComposite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/settings");
      if (!res.ok) {
        throw new Error("Failed to load settings.");
      }
      const data = await res.json();
      setComposite(data);
    } catch (err: any) {
      setError(err.message || "Unable to retrieve tax configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (loading) {
    return (
      <SettingsLayout>
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-sm font-medium text-slate-600">Loading Tax Master Data & SAP VAT Mappings...</span>
        </div>
      </SettingsLayout>
    );
  }

  if (error || !composite) {
    return (
      <SettingsLayout>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <h3 className="font-semibold text-base">Error Loading Tax Master Data</h3>
          </div>
          <p className="text-sm">{error || "Unable to reach endpoint."}</p>
          <button
            onClick={loadSettings}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout>
      <VATMappingEditor
        connectionId={composite.sap_connection?.id || null}
        mappings={composite.tax_configuration?.vat_mappings || []}
        onSaved={loadSettings}
      />
    </SettingsLayout>
  );
}
