"use client";

import { useState, useEffect } from "react";
import { KRAParsingProfilesConfig, SystemSettings } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import {
  FileSpreadsheet,
  FileCheck,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

interface KRAParsingProfilesCardProps {
  settings: SystemSettings;
  onSaved: () => void;
}

const KRA_FIELDS = [
  "pin_column",
  "partner_name_column",
  "invoice_number_column",
  "invoice_date_column",
  "cu_number_column",
  "base_amount_column",
] as const;

const availableSections = ["SEC_B", "SEC_F", "SEC_G", "SEC_H", "SEC_I"];

export function KRAParsingProfilesCard({ settings, onSaved }: KRAParsingProfilesCardProps) {
  const [kraParsingProfiles, setKraParsingProfiles] = useState<KRAParsingProfilesConfig>(
    settings.kra_parsing_profiles || { schema_version: 1, profiles: {} }
  );
  const [activeProfileTab, setActiveProfileTab] = useState("SEC_B");

  useEffect(() => {
    if (settings.kra_parsing_profiles) {
      const timer = setTimeout(() => {
        setKraParsingProfiles(settings.kra_parsing_profiles!);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [settings.kra_parsing_profiles]);

  const handleProfileChange = (section: string, field: string, value: string) => {
    const numValue = value === "" ? null : parseInt(value, 10);
    setKraParsingProfiles(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [section]: {
          ...prev.profiles[section],
          [field]: numValue,
        },
      },
    }));
  };

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        kra_parsing_profiles: kraParsingProfiles,
        version: settings.version,
      };

      const res = await fetchWithAuth("/settings/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const errData = await res.json();
        throw new Error(errData.detail || "Optimistic lock conflict: Settings modified by another administrator.");
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update KRA CSV parsing profiles.");
      }

      setSuccessMessage("KRA CSV parsing profiles updated successfully!");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || "An error occurred while saving KRA CSV parsing profiles.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <FileSpreadsheet className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              KRA CSV Parsing Profiles
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Map the 0-based column index for each KRA section.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 font-mono">
          v{settings.version}
        </span>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>{successMessage}</div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex bg-slate-50 border-b border-slate-200 overflow-x-auto p-1.5 gap-1">
            {availableSections.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setActiveProfileTab(sec)}
                aria-pressed={activeProfileTab === sec}
                className={`px-4 py-2 text-xs font-bold transition-colors rounded-md cursor-pointer border ${
                  activeProfileTab === sec
                    ? "bg-white text-blue-700 shadow-sm border-slate-200"
                    : "text-slate-500 border-transparent hover:text-slate-800"
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          <div className="p-4 bg-white">
            <div key={activeProfileTab}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {KRA_FIELDS.map((field) => (
                  <div key={field} className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 capitalize">
                      {field.replace(/_/g, " ")}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={(kraParsingProfiles.profiles as unknown as Record<string, Record<string, number | null>>)[activeProfileTab]?.[field] ?? ""}
                      onChange={e => handleProfileChange(activeProfileTab, field, e.target.value)}
                      placeholder="–"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-300"
                    />
                  </div>
                ))}
              </div>

              {/* Lightweight Preview */}
              <div className="mt-6 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  Example Data Mapping (Column 0, 1, 2...)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono text-slate-500">
                    <thead>
                      <tr className="bg-slate-200/50">
                        {[0,1,2,3,4,5,6,7].map(col => {
                          const mappedField = Object.entries((kraParsingProfiles.profiles as unknown as Record<string, Record<string, number | null>>)[activeProfileTab] || {}).find(([, val]) => val === col);
                          const fieldName = mappedField ? mappedField[0].replace("_column", "") : `Col ${col}`;
                          return (
                            <th key={col} className="px-2 py-1 font-semibold text-slate-700 whitespace-nowrap border-b border-slate-200">
                              {fieldName}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {[0,1,2,3,4,5,6,7].map(col => (
                          <td key={col} className="px-2 py-1.5 whitespace-nowrap text-[11px]">Data...</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save KRA Parsing Profiles
          </button>
        </div>
      </form>
    </div>
  );
}
