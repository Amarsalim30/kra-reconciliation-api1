"use client";

import { useState } from "react";
import { SystemSettings } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import {
  Sliders,
  AlertTriangle,
  Percent,
  Calendar,
  UserCheck,
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
  const [dateTolerance, setDateTolerance] = useState(settings.date_tolerance);
  const [partnerSimilarityThreshold, setPartnerSimilarityThreshold] = useState(
    settings.partner_similarity_threshold
  );
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const numericTolerance = parseFloat(amountTolerance) || 0;
  const showToleranceWarning = numericTolerance > 1000.0;

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage("Audit note reason is mandatory for operational rule changes.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        amount_tolerance: amountTolerance,
        date_tolerance: Number(dateTolerance),
        partner_similarity_threshold: Number(partnerSimilarityThreshold),
        version: settings.version,
        reason: reason.trim(),
      };

      const res = await fetchWithAuth("/settings/reconciliation", {
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
        throw new Error(errData.detail || "Failed to update reconciliation rules.");
      }

      setReason("");
      setSuccessMessage("Operational reconciliation rules and matching tolerances saved successfully!");
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving reconciliation settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
            <Sliders className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-white">
              Operational Matching Rules & Tolerances
            </h2>
            <p className="text-xs text-slate-400">
              Configure base amount variance (KES), invoice date tolerance (Days), and partner name fuzzy threshold.
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

        {/* Amount Tolerance Input */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-slate-500" />
              Base Amount Variance Tolerance (KES)
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
                <strong>High Tolerance Warning:</strong> Variance above KES 1,000.00 will automatically accept invoice pairs despite substantial financial discrepancy.
              </div>
            </div>
          )}
        </div>

        {/* Date Tolerance Input */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Invoice Date Tolerance (Days)
            </label>
            <span className="text-xs font-mono font-bold text-slate-900">
              ±{dateTolerance} Days
            </span>
          </div>

          <input
            type="number"
            min="0"
            max="30"
            value={dateTolerance}
            onChange={(e) => setDateTolerance(Number(e.target.value))}
            required
            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        {/* Partner Name Similarity Threshold */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              Partner Name Fuzzy Similarity Threshold
            </label>
            <span className="text-xs font-mono font-bold text-indigo-600">
              {(partnerSimilarityThreshold * 100).toFixed(0)}% Match
            </span>
          </div>

          <input
            type="range"
            min="0.50"
            max="1.00"
            step="0.05"
            value={partnerSimilarityThreshold}
            onChange={(e) => setPartnerSimilarityThreshold(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer text-indigo-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>50% (Loose)</span>
            <span>85% (Recommended)</span>
            <span>100% (Exact)</span>
          </div>
        </div>

        {/* Audit Note Reason */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Audit Note Reason <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Reason for changing operational reconciliation rules..."
            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Operational Rules
          </button>
        </div>
      </form>
    </div>
  );
}
