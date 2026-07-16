"use client";

import { useState } from "react";
import { KRAVATMappingItem, VatRateCategory } from "@/types/settings";
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
        canonical_value: "VAT_16",
      },
    ]);
  };

  const handleRemove = (index: number) => {
    const newMappings = [...mappings];
    newMappings.splice(index, 1);
    setMappings(newMappings);
  };

  const handleChange = (index: number, field: keyof KRAVATMappingItem, value: any) => {
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
          canonical_value: m.canonical_value,
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
    } catch (err: any) {
      setError(err.message || "An error occurred saving KRA VAT mappings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
            <Tag className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">KRA CSV VAT Assignment</h2>
            <p className="text-slate-400 text-xs mt-0.5">Map KRA CSV filename prefixes to canonical VAT rates.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800 mb-6">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">How VAT Assignment Works</p>
            <p className="opacity-90">
              During CSV upload, the system will check if the uploaded filename starts with any of the prefixes below. If a match is found, the entire file will be assigned the corresponding canonical VAT rate, ignoring the VAT Group column.
            </p>
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
                  className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-sm"
                />
              </div>
              <div className="w-48">
                <select
                  value={mapping.canonical_value}
                  onChange={(e) => handleChange(idx, "canonical_value", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  <option value="VAT_16">VAT 16%</option>
                  <option value="VAT_8">VAT 8%</option>
                  <option value="ZERO_RATED">Zero Rated</option>
                  <option value="EXEMPT">Exempt</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
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
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 h-[38px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Mappings
          </button>
        </div>
      </form>
    </div>
  );
}
