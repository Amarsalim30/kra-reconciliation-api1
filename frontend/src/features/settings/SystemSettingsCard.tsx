"use client";

import { useState, useEffect } from "react";
import { BaseAmountPolicy, PurchaseCUField, SystemSettings, UnmappedVatPolicy } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import {
  Sliders,
  AlertTriangle,
  FileCheck,
  Percent,
  Layers,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

interface SystemSettingsCardProps {
  settings: SystemSettings;
  onSaved: () => void;
}

export function SystemSettingsCard({ settings, onSaved }: SystemSettingsCardProps) {
  const [amountTolerance, setAmountTolerance] = useState(settings.amount_tolerance);
  const [baseAmountPolicy, setBaseAmountPolicy] = useState<BaseAmountPolicy>(
    settings.base_amount_policy
  );
  const [unmappedVatPolicy, setUnmappedVatPolicy] = useState<UnmappedVatPolicy>(
    settings.unmapped_vat_policy
  );
  const [purchaseCuSource, setPurchaseCuSource] = useState<PurchaseCUField>(
    settings.purchase_cu_source
  );
  
  const [kraParsingProfiles, setKraParsingProfiles] = useState(
    settings.kra_parsing_profiles || { schema_version: 1, profiles: {} }
  );

  useEffect(() => {
    if (settings.kra_parsing_profiles) {
      setKraParsingProfiles(settings.kra_parsing_profiles);
    }
  }, [settings.kra_parsing_profiles]);

  const [activeProfileTab, setActiveProfileTab] = useState("SEC_B");
  const availableSections = ["SEC_B", "SEC_F", "SEC_G", "SEC_H", "SEC_I"];

  const handleProfileChange = (section: string, field: string, value: string) => {
    const numValue = value === "" ? null : parseInt(value, 10);
    setKraParsingProfiles(prev => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [section]: {
          ...prev.profiles[section],
          [field]: numValue
        }
      }
    }));
  };


  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const numericTolerance = parseFloat(amountTolerance) || 0;
  const showToleranceWarning = numericTolerance > 1000.0;

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        amount_tolerance: amountTolerance,
        base_amount_policy: baseAmountPolicy,
        unmapped_vat_policy: unmappedVatPolicy,
        purchase_cu_source: purchaseCuSource,
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
        throw new Error(errData.detail || "Failed to update system settings.");
      }

      setSuccessMessage("Operational reconciliation rules updated successfully!");
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving system settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
            <Sliders className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-white">
              Operational Reconciliation Rules & Flags
            </h2>
            <p className="text-xs text-slate-400">
              Configure amount variances, zero-amount handling, missing CU flags, and ingestion filters.
            </p>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-mono">Setting Version v{settings.version}</span>
      </div>

      <form onSubmit={handleSaveSystemSettings} className="p-6 space-y-6">
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

        {/* Amount Tolerance Card */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-slate-500" />
              Maximum Amount Tolerance (KES)
            </label>
            <span className="text-xs font-mono font-bold text-slate-900">
              KES {numericTolerance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <input
            type="number"
            step="0.01"
            min="0"
            max="1000000"
            value={amountTolerance}
            onChange={(e) => setAmountTolerance(e.target.value)}
            required
            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />

          {showToleranceWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <strong>High Tolerance Warning:</strong> Variance above KES 1,000.00 will automatically mark invoices as MATCHED despite substantial financial discrepancy.
              </div>
            </div>
          )}
        </div>

        {/* Policies Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Base Amount Discrepancy Policy
            </label>
            <select
              value={baseAmountPolicy}
              onChange={(e) => setBaseAmountPolicy(e.target.value as BaseAmountPolicy)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            >
              <option value="skip">Skip Record (Default)</option>
              <option value="reject_session">Reject Entire Reconciliation Session</option>
              <option value="treat_as_zero">Treat Missing Base Amount as 0.00 KES</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-slate-500" />
              Unmapped VAT Tax Code Policy
            </label>
              <select
                value={unmappedVatPolicy}
                onChange={(e) => setUnmappedVatPolicy(e.target.value as UnmappedVatPolicy)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
              >
                <option value="needs_review">Mark for Audit Review (NEEDS_REVIEW)</option>
                <option value="reject_invoice">Reject Specific Invoice Immediately</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Purchase CU Number Source
              </label>
              <select
                value={purchaseCuSource}
                onChange={(e) => setPurchaseCuSource(e.target.value as PurchaseCUField)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
              >
                <option value="U_CUINV">KRA (U_CUINV)</option>
                <option value="NumAtCard">Vendor Reference (NumAtCard)</option>
                <option value="Comments">Comments</option>
                <option value="JournalMemo">Journal Memo (JournalMemo)</option>
                <option value="Reference1">Invoice Number (Reference1)</option>
              </select>
              <span className="text-[11px] text-slate-500 block">
                SAP field that stores the Control Unit number on Purchase Invoices.
              </span>
            </div>
          </div>

        {/* KRA CSV Parsing Profiles */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                KRA CSV Parsing Profiles
              </h3>
              <p className="text-[11px] text-slate-500">
                Map the 0-based column index for each KRA section.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex bg-slate-50 border-b border-slate-200 overflow-x-auto">
              {availableSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setActiveProfileTab(sec)}
                  className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                    activeProfileTab === sec
                      ? "border-blue-700 text-blue-700 bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
            
            <div className="p-4 bg-white">
              {availableSections.map((sec) => (
                <div key={sec} className={activeProfileTab === sec ? "block" : "hidden"}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {["pin_column", "partner_name_column", "invoice_number_column", "invoice_date_column", "cu_number_column", "base_amount_column"].map((field) => (
                      <div key={field} className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 capitalize">
                          {field.replace(/_/g, " ")}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={(kraParsingProfiles.profiles as Record<string, any>)[sec]?.[field] ?? ""}
                          onChange={e => handleProfileChange(sec, field, e.target.value)}
                          placeholder="-"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
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
                              const mappedField = Object.entries((kraParsingProfiles.profiles as Record<string, any>)[sec] || {}).find(([, val]) => val === col);
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
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Operational Rules
          </button>
        </div>
      </form>
    </div>
  );
}
