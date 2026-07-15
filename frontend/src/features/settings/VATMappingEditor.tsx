"use client";

import { useState } from "react";
import { SAPVatMappingItem } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import {
  Plus,
  Trash2,
  Lock,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Tag,
  ShoppingBag,
  ShoppingCart,
} from "lucide-react";

interface VATMappingEditorProps {
  connectionId: number | null;
  mappings: SAPVatMappingItem[];
  onSaved: () => void;
}

export function VATMappingEditor({ connectionId, mappings: initialMappings, onSaved }: VATMappingEditorProps) {
  const [mappings, setMappings] = useState<SAPVatMappingItem[]>(initialMappings);
  const [activeModule, setActiveModule] = useState<"purchases" | "sales">("purchases");
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newBucketCode, setNewBucketCode] = useState<string>("STANDARD");

  const filteredMappings = mappings.filter((m) => m.module === activeModule);

  const handleBucketChange = (index: number, bucketCode: string) => {
    const updated = [...mappings];
    const target = filteredMappings[index];
    const targetIdx = mappings.findIndex(
      (m) => m.module === target.module && m.sap_code.toUpperCase() === target.sap_code.toUpperCase()
    );
    if (targetIdx !== -1) {
      updated[targetIdx].vat_bucket_code = bucketCode;
      setMappings(updated);
    }
  };

  const handleDescriptionChange = (index: number, newDesc: string) => {
    const updated = [...mappings];
    const target = filteredMappings[index];
    const targetIdx = mappings.findIndex(
      (m) => m.module === target.module && m.sap_code.toUpperCase() === target.sap_code.toUpperCase()
    );
    if (targetIdx !== -1) {
      updated[targetIdx].description = newDesc;
      setMappings(updated);
    }
  };

  const handleAddCustomCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const codeUpper = newCode.trim().toUpperCase();
    const exists = mappings.some((m) => m.module === activeModule && m.sap_code.toUpperCase() === codeUpper);
    if (exists) {
      setErrorMessage(`Tax code '${codeUpper}' already exists in ${activeModule}.`);
      return;
    }

    setMappings([
      ...mappings,
      {
        module: activeModule,
        sap_code: codeUpper,
        description: newDescription.trim() || `${codeUpper} Custom Tax Group`,
        vat_bucket_code: newBucketCode,
        is_builtin: false,
      },
    ]);

    setNewCode("");
    setNewDescription("");
    setNewBucketCode("STANDARD");
    setErrorMessage(null);
  };

  const handleDeleteCode = (sapCode: string) => {
    const target = mappings.find((m) => m.module === activeModule && m.sap_code.toUpperCase() === sapCode.toUpperCase());
    if (target?.is_builtin) {
      setErrorMessage(`Cannot delete built-in system tax code '${sapCode}'.`);
      return;
    }
    setMappings(mappings.filter((m) => !(m.module === activeModule && m.sap_code.toUpperCase() === sapCode.toUpperCase())));
  };

  const handleSaveMappings = async () => {
    if (!reason.trim()) {
      setErrorMessage("Audit note reason is mandatory for saving tax mappings.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        connection_id: connectionId || undefined,
        reason: reason.trim(),
        mappings: mappings.map((m) => ({
          module: m.module,
          sap_code: m.sap_code,
          description: m.description,
          vat_bucket_code: m.vat_bucket_code,
          is_builtin: m.is_builtin,
        })),
      };

      const res = await fetchWithAuth("/settings/tax", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update tax mappings.");
      }

      setReason("");
      setSuccessMessage("Canonical VAT tax code mappings updated successfully!");
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving VAT mappings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all space-y-6 p-6">
      {/* Top Title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">SAP VAT Code Normalizer</h2>
            <p className="text-xs text-slate-500">
              Link customer SAP tax codes (e.g. O1, I1) to canonical rate buckets (STANDARD, REDUCED, ZERO, EXEMPT).
            </p>
          </div>
        </div>
      </div>

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

      {/* Module Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveModule("purchases")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeModule === "purchases"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Purchases (Input VAT)
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[10px]">
            {mappings.filter((m) => m.module === "purchases").length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule("sales")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeModule === "sales"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Sales (Output VAT)
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[10px]">
            {mappings.filter((m) => m.module === "sales").length}
          </span>
        </button>
      </div>

      {/* Tax Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">SAP Tax Code</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Target Rate Bucket</th>
              <th className="py-3 px-4 text-center">Built-in Guard</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {filteredMappings.map((item, index) => (
              <tr key={`${item.module}-${item.sap_code}`} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.sap_code}</td>
                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleDescriptionChange(index, e.target.value)}
                    className="w-full px-2.5 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </td>
                <td className="py-3 px-4">
                  <select
                    value={item.vat_bucket_code}
                    onChange={(e) => handleBucketChange(index, e.target.value)}
                    className="px-2.5 py-1 text-xs rounded border border-slate-300 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="STANDARD">STANDARD (Standard Rate 16%)</option>
                    <option value="REDUCED">REDUCED (Reduced Rate 8%)</option>
                    <option value="ZERO">ZERO (Zero Rated 0%)</option>
                    <option value="EXEMPT">EXEMPT (Exempt Tax Free)</option>
                  </select>
                </td>
                <td className="py-3 px-4 text-center">
                  {item.is_builtin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Built-in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      Custom
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {!item.is_builtin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCode(item.sap_code)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Remove custom code"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAddCustomCode} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-emerald-600" />
          Add Custom SAP Tax Code ({activeModule.toUpperCase()})
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="SAP Code (e.g. S1)"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            required
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="Description (e.g. Special Rate)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-xs focus:outline-none focus:border-blue-500"
          />
          <select
            value={newBucketCode}
            onChange={(e) => setNewBucketCode(e.target.value)}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="STANDARD">STANDARD (16%)</option>
            <option value="REDUCED">REDUCED (8%)</option>
            <option value="ZERO">ZERO (0%)</option>
            <option value="EXEMPT">EXEMPT</option>
          </select>
          <button
            type="submit"
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors shadow-xs"
          >
            Add Code
          </button>
        </div>
      </form>

      {/* Mandatory Reason Note */}
      <div className="space-y-1.5 pt-3 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Audit Note Reason <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          placeholder="Reason for changing VAT mapping rules (e.g. Updating petroleum 8% input code)..."
          className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
        />
      </div>

      {/* Action Bar */}
      <div className="pt-4 border-t border-slate-200 flex justify-end">
        <button
          type="button"
          onClick={handleSaveMappings}
          disabled={saving}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Tax Mappings
        </button>
      </div>
    </div>
  );
}
