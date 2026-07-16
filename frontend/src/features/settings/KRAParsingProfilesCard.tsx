"use client";

import { useState, useEffect } from "react";
import { KRAParsingProfilesConfig, SystemSettings } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import {
  FileSpreadsheet,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Columns3,
} from "lucide-react";

interface KRAParsingProfilesCardProps {
  settings: SystemSettings;
  onSaved: () => void;
}

const KRA_FIELDS = [
  { key: "pin_column", label: "PIN Column Index", desc: "KRA Taxpayer PIN column position" },
  { key: "partner_name_column", label: "Partner Name Column", desc: "Supplier/Customer Name column position" },
  { key: "invoice_number_column", label: "Invoice Number Column", desc: "Tax Invoice / Credit Note reference" },
  { key: "invoice_date_column", label: "Invoice Date Column", desc: "Date of invoice issue" },
  { key: "cu_number_column", label: "Control Unit (CU) Column", desc: "Control Unit Serial / Fiscal Receipt #" },
  { key: "base_amount_column", label: "Base Taxable Amount Column", desc: "Base amount prior to VAT calculation" },
] as const;

const SECTION_META: Record<string, { label: string; rate: string; desc: string }> = {
  SEC_B: { label: "Schedule B — General Sales", rate: "16%", desc: "General rated sales supplies" },
  SEC_F: { label: "Schedule F — Local Purchases", rate: "16%", desc: "Standard rated local input purchases" },
  SEC_G: { label: "Schedule G — Fuel & Petroleum", rate: "8%", desc: "Other rated energy & fuel purchases" },
  SEC_H: { label: "Schedule H — Zero-Rated Purchases", rate: "0%", desc: "Zero-rated supplies (0% VAT)" },
  SEC_I: { label: "Schedule I — Exempt Purchases", rate: "EXEMPT", desc: "Exempt supplies (Non-VATable)" },
};

const KRA_DEFAULT_COLUMNS: Record<string, number> = {
  pin_column: 0,
  partner_name_column: 1,
  invoice_number_column: 2,
  invoice_date_column: 3,
  cu_number_column: 4,
  base_amount_column: 5,
};

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
    setKraParsingProfiles((prev) => ({
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

  const handleApplyDefaults = (section: string) => {
    setKraParsingProfiles((prev) => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [section]: {
          ...prev.profiles[section],
          ...KRA_DEFAULT_COLUMNS,
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

      setSuccessMessage("KRA CSV parsing profiles saved successfully!");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || "An error occurred while saving KRA CSV parsing profiles.");
    } finally {
      setSaving(false);
    }
  };

  const currentSectionMeta = SECTION_META[activeProfileTab] || {
    label: activeProfileTab,
    rate: "16%",
    desc: "KRA CSV Schedule Parsing Profile",
  };

  const activeProfileData =
    (kraParsingProfiles.profiles as unknown as Record<string, Record<string, number | null>>)[activeProfileTab] || {};

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Workspace Header */}
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              KRA CSV Structure Parsing Profiles
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify 0-based column index mappings for automated extraction across KRA iTax schedule sections
            </p>
          </div>
        </div>
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

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {/* Section Navigation Tabs */}
          <div className="flex bg-slate-50 border-b border-slate-200 overflow-x-auto p-2 gap-1.5">
            {availableSections.map((sec) => {
              const meta = SECTION_META[sec];
              const isActive = activeProfileTab === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setActiveProfileTab(sec)}
                  aria-pressed={isActive}
                  className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-100/70"
                  }`}
                >
                  <span>{sec}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                      isActive ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {meta?.rate || "16%"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-6 bg-white space-y-6">
            {/* Active Section Info & Preset Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200/80">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {currentSectionMeta.label}
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {currentSectionMeta.rate} VAT
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{currentSectionMeta.desc}</p>
              </div>

              <button
                type="button"
                onClick={() => handleApplyDefaults(activeProfileTab)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Apply KRA Standard Layout (Col 0–5)
              </button>
            </div>

            {/* Column Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {KRA_FIELDS.map((f) => {
                const val = activeProfileData[f.key] ?? "";
                return (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>{f.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">0-indexed</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={val}
                      onChange={(e) => handleProfileChange(activeProfileTab, f.key, e.target.value)}
                      placeholder="e.g. 0"
                      className="w-full px-3.5 py-2 h-10 rounded-lg border border-slate-200 bg-white font-mono text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-300"
                    />
                    <p className="text-[11px] text-slate-500">{f.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Interactive Data Mapping Matrix Preview */}
            <div className="mt-6 p-4 bg-slate-50/70 rounded-xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Columns3 className="w-4 h-4 text-blue-600" />
                  Live CSV Column Index Mapping Matrix
                </span>
                <span className="text-[11px] text-slate-500 font-medium">First 8 Columns (Col 0 - 7)</span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => {
                        const mappedEntry = Object.entries(activeProfileData).find(([, val]) => val === col);
                        const isMapped = Boolean(mappedEntry);
                        const labelName = mappedEntry
                          ? mappedEntry[0].replace("_column", "").replace(/_/g, " ")
                          : `Unmapped`;

                        return (
                          <th
                            key={col}
                            className={`px-3 py-2 border-r last:border-r-0 border-slate-200 font-medium whitespace-nowrap ${
                              isMapped ? "bg-blue-50 text-blue-900 font-bold" : "text-slate-400"
                            }`}
                          >
                            <div className="text-[10px] text-slate-500 font-normal">Column {col}</div>
                            <div className="capitalize text-xs">{labelName}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => {
                        const isMapped = Object.values(activeProfileData).includes(col);
                        return (
                          <td
                            key={col}
                            className={`px-3 py-2.5 border-r last:border-r-0 border-slate-200 text-[11px] whitespace-nowrap ${
                              isMapped ? "bg-blue-50/30 text-blue-700 font-semibold" : "text-slate-400"
                            }`}
                          >
                            {isMapped ? "Active Data Field" : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => handleApplyDefaults(activeProfileTab)}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" /> Reset Section
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Parsing Profiles
          </button>
        </div>
      </form>
    </div>
  );
}
