"use client";

import { useState } from "react";
import { KRAVATMappingItem } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import {
  Save,
  Plus,
  Trash2,
  Tag,
  Loader2,
  Info,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface KRAVATMappingEditorProps {
  mappings: KRAVATMappingItem[];
  onSaved: () => void;
}

const DEFAULT_SCHEDULE_GUIDE = [
  {
    prefix: "SEC_B",
    filePattern: "SEC_B_WITH_VAT_PIN1.csv",
    title: "B – General Rated Supplies (Sales)",
    rate: "16",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    desc: "Standard 16% VAT rate on taxable sales supplies",
  },
  {
    prefix: "SEC_F",
    filePattern: "SEC_F_WITH_VAT_PIN1.csv",
    title: "F – General Rated Purchases (Local)",
    rate: "16",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    desc: "Standard 16% input VAT rate on local purchases",
  },
  {
    prefix: "SEC_G",
    filePattern: "SEC_G_WITH_VAT_PIN1.csv",
    title: "G – Other Rated Purchases",
    rate: "8",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    desc: "8% reduced rate (fuel, oil & petroleum products)",
  },
  {
    prefix: "SEC_H",
    filePattern: "SEC_H_WITH_VAT_PIN1.csv",
    title: "H – Zero-Rated Purchases",
    rate: "0",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    desc: "0% zero-rated schedule (not 8% or 16%)",
  },
  {
    prefix: "SEC_I",
    filePattern: "SEC_I_WITH_VAT_PIN1.csv",
    title: "I – Exempt Purchases",
    rate: "EXEMPT",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    desc: "Exempt supplies schedule (distinct tax-free schedule)",
  },
];

function getRateBadge(rate: string) {
  const normalized = rate.trim().toUpperCase();
  if (normalized === "16") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200">16% Standard</span>;
  }
  if (normalized === "8") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">8% Reduced</span>;
  }
  if (normalized === "0") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">0% Zero-Rated</span>;
  }
  if (normalized === "EXEMPT") {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200">EXEMPT Tax-Free</span>;
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{rate}%</span>;
}

export function KRAVATMappingEditor({ mappings: initialMappings, onSaved }: KRAVATMappingEditorProps) {
  const [mappings, setMappings] = useState<KRAVATMappingItem[]>(initialMappings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [reason, setReason] = useState("");

  const handleAdd = (defaultPrefix = "", defaultRate = "16") => {
    setMappings([
      ...mappings,
      {
        section_prefix: defaultPrefix,
        canonical_rate: defaultRate,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    const newMappings = [...mappings];
    newMappings.splice(index, 1);
    setMappings(newMappings);
  };

  const handleChange = (index: number, field: keyof KRAVATMappingItem, value: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Client side validation
    const prefixes = new Set();
    for (const m of mappings) {
      if (!m.section_prefix.trim()) {
        setError("Section prefix cannot be empty.");
        setSaving(false);
        return;
      }
      const upper = m.section_prefix.trim().toUpperCase();
      if (prefixes.has(upper)) {
        setError(`Duplicate prefix '${upper}' found in mappings.`);
        setSaving(false);
        return;
      }
      prefixes.add(upper);
    }

    try {
      const payload = {
        mappings: mappings.map((m) => ({
          section_prefix: m.section_prefix.trim().toUpperCase(),
          canonical_rate: m.canonical_rate,
        })),
        reason: reason.trim() || undefined,
      };

      const res = await fetchWithAuth("/settings/kra-vat-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update KRA VAT mappings.");
      }

      setReason("");
      setSuccess(true);
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "An error occurred saving KRA VAT mappings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">KRA Section VAT Mappings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enforce canonical VAT rate groups by matching KRA CSV filename prefixes during ingestion
            </p>
          </div>
        </div>
      </div>

      <datalist id="kra-vat-rates-list">
        <option value="16">16% (Standard Rate)</option>
        <option value="12">12% (Policy Exception Rate)</option>
        <option value="8">8% (Fuel & Petroleum Reduced Rate)</option>
        <option value="0">0% (Zero Rated Schedule)</option>
        <option value="EXEMPT">Exempt (Tax Free Schedule)</option>
      </datalist>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>KRA Section VAT mappings saved successfully!</div>
          </div>
        )}

        {/* Enterprise Schedule Guide Table */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              Official KRA iTax Schedule Reference Guide
            </div>
            <span className="text-[11px] font-medium text-slate-500">Standard Filing Patterns</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 border-b border-slate-200 font-semibold text-slate-700">
                <tr>
                  <th className="px-3.5 py-2.5">Filename Pattern</th>
                  <th className="px-3.5 py-2.5">Schedule Section Name</th>
                  <th className="px-3.5 py-2.5">Canonical VAT Group</th>
                  <th className="px-3.5 py-2.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DEFAULT_SCHEDULE_GUIDE.map((guide) => {
                  const alreadyMapped = mappings.some(
                    (m) => m.section_prefix.trim().toUpperCase() === guide.prefix
                  );

                  return (
                    <tr key={guide.prefix} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 text-[11px]">
                        {guide.filePattern}
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-800">
                        {guide.title}
                        <div className="text-[11px] text-slate-500 font-normal">{guide.desc}</div>
                      </td>
                      <td className="px-3.5 py-2.5">{getRateBadge(guide.rate)}</td>
                      <td className="px-3.5 py-2.5 text-right">
                        {!alreadyMapped ? (
                          <button
                            type="button"
                            onClick={() => handleAdd(guide.prefix, guide.rate)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-semibold text-[11px] transition-colors cursor-pointer border border-blue-200"
                          >
                            <Sparkles className="w-3 h-3 text-blue-600" /> + Add Mapping
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">Mapped</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mapping Rows */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Active Prefix Mappings ({mappings.length})
            </h3>
            <span className="text-[11px] text-slate-500">Prefix searches matching filenames on upload</span>
          </div>

          {mappings.map((mapping, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">
                    Filename Prefix
                  </label>
                  <input
                    type="text"
                    value={mapping.section_prefix}
                    onChange={(e) => handleChange(idx, "section_prefix", e.target.value)}
                    placeholder="e.g. SEC_B"
                    className="w-full px-3.5 py-2 h-10 border border-slate-200 bg-white rounded-lg font-mono text-xs text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">
                    Canonical VAT Rate
                  </label>
                  <input
                    type="text"
                    list="kra-vat-rates-list"
                    value={mapping.canonical_rate}
                    onChange={(e) => handleChange(idx, "canonical_rate", e.target.value)}
                    placeholder="e.g. 16, 8, EXEMPT"
                    className="w-full px-3.5 py-2 h-10 border border-slate-200 rounded-lg text-xs bg-white text-slate-900 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <div className="shrink-0">{getRateBadge(mapping.canonical_rate)}</div>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Remove mapping"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {mappings.length === 0 && (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
              No custom prefix mappings defined. Use the schedule reference table above or click &quot;Add Prefix Mapping&quot; to configure canonical rules.
            </div>
          )}
        </div>

        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => handleAdd()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200/80 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Custom Prefix Mapping
          </button>
        </div>

        {/* Audit Trail Note & Save Controls */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Audit Change Log Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Standardized SEC_B and SEC_F canonical rates"
              className="w-full px-3.5 py-2.5 h-10 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-semibold text-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save KRA Section Mappings
          </button>
        </div>
      </form>
    </div>
  );
}
