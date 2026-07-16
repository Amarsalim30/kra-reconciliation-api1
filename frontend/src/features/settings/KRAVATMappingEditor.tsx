"use client";

import { useState } from "react";
import { KRAVATMappingItem } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import { Save, Plus, Trash2, Tag, Loader2, Info } from "lucide-react";

interface KRAVATMappingEditorProps {
  mappings: KRAVATMappingItem[];
  onSaved: () => void;
}

export function KRAVATMappingEditor({ mappings: initialMappings, onSaved }: KRAVATMappingEditorProps) {
  const [mappings, setMappings] = useState<KRAVATMappingItem[]>(initialMappings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const handleAdd = () => {
    setMappings([
      ...mappings,
      {
        section_prefix: "",
        canonical_rate: "16",
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
        setError(`Duplicate prefix '${upper}' found.`);
        setSaving(false);
        return;
      }
      prefixes.add(upper);
    }

    try {
      const payload = {
        mappings: mappings.map(m => ({
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
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "An error occurred saving KRA VAT mappings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <Tag className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">KRA Section Mapping</h2>
            <p className="text-xs text-slate-500 mt-0.5">Map KRA CSV filename prefixes to canonical VAT rates.</p>
          </div>
        </div>
      </div>

      <datalist id="kra-vat-rates-list">
        <option value="16">16% (Standard Rate)</option>
        <option value="12">12% (New Policy)</option>
        <option value="8">8% (Reduced Rate)</option>
        <option value="0">0% (Zero Rated)</option>
        <option value="EXEMPT">Exempt (Tax Free)</option>
      </datalist>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wider">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            KRA Standard Return Sections & Canonical VAT Rates Reference
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            During CSV ingestion, the file prefix maps directly to KRA VAT return schedule rules. Matching filenames automatically enforce canonical VAT rate groups during automated reconciliation:
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200 font-semibold text-slate-700">
                <tr>
                  <th className="px-3 py-2">Expected Filename Pattern</th>
                  <th className="px-3 py-2">KRA Return Section Name</th>
                  <th className="px-3 py-2">Canonical Rate Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-600">
                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-bold text-slate-900">SEC_B_WITH_VAT_PIN1.csv</td>
                  <td className="px-3 py-2 font-sans font-medium text-slate-800">B – General Rated Supplies (Sales)</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">16%</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-bold text-slate-900">SEC_F_WITH_VAT_PIN1.csv</td>
                  <td className="px-3 py-2 font-sans font-medium text-slate-800">F – General Rated Purchases (Local)</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">16%</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-bold text-slate-900">SEC_G_WITH_VAT_PIN1.csv</td>
                  <td className="px-3 py-2 font-sans font-medium text-slate-800">G – Other Rated Purchases</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">8% (Petroleum / Fuel)</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-bold text-slate-900">SEC_H_WITH_VAT_PIN1.csv</td>
                  <td className="px-3 py-2 font-sans font-medium text-slate-800">H – Zero-Rated Purchases</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">0% (Zero-Rated)</span></td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-bold text-slate-900">SEC_I_WITH_VAT_PIN1.csv</td>
                  <td className="px-3 py-2 font-sans font-medium text-slate-800">I – Exempt Purchases</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">EXEMPT (Tax-Free)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {mappings.map((mapping, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={mapping.section_prefix}
                  onChange={(e) => handleChange(idx, "section_prefix", e.target.value)}
                  placeholder="e.g. SEC_B"
                  className="w-full px-3 py-2.5 h-10 border border-slate-200 rounded-lg font-mono text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                />
              </div>
              <div className="w-48">
                <input
                  type="text"
                  list="kra-vat-rates-list"
                  value={mapping.canonical_rate}
                  onChange={(e) => handleChange(idx, "canonical_rate", e.target.value)}
                  placeholder="e.g. 16, 0, EXEMPT"
                  className="w-full px-3 py-2.5 h-10 border border-slate-200 rounded-lg text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer mt-0.5"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Mapping
        </button>

        <div className="pt-6 border-t border-slate-100 flex items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Reason for Change (Audit Note)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Added SEC_F mapping"
              className="w-full px-3.5 py-2.5 h-10 rounded-lg border border-slate-200 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-semibold text-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Mappings
          </button>
        </div>
      </form>
    </div>
  );
}
