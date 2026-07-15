"use client";

import { useState } from "react";
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
  HelpCircle,
  History,
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
  const [ignoreMissingCu, setIgnoreMissingCu] = useState(settings.ignore_missing_cu);
  const [includeCreditNotes, setIncludeCreditNotes] = useState(settings.include_credit_notes);
  const [includeDebitNotes, setIncludeDebitNotes] = useState(settings.include_debit_notes);
  const [skipCancelled, setSkipCancelled] = useState(settings.skip_cancelled);
  const [purchaseCuSource, setPurchaseCuSource] = useState<PurchaseCUField>(
    settings.purchase_cu_source
  );
  
  // KRA CSV Mapping Fields
  const [kraPinCol, setKraPinCol] = useState(settings.kra_csv_pin_column);
  const [kraPartnerCol, setKraPartnerCol] = useState(settings.kra_csv_partner_name_column);
  const [kraInvNoCol, setKraInvNoCol] = useState(settings.kra_csv_invoice_number_column);
  const [kraDateCol, setKraDateCol] = useState(settings.kra_csv_invoice_date_column);
  const [kraCuCol, setKraCuCol] = useState(settings.kra_csv_cu_number_column);
  const [kraVatCol, setKraVatCol] = useState(settings.kra_csv_vat_group_column);
  const [kraBaseCol, setKraBaseCol] = useState(settings.kra_csv_base_amount_column);

  const [reason, setReason] = useState("");

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
        ignore_missing_cu: ignoreMissingCu,
        include_credit_notes: includeCreditNotes,
        include_debit_notes: includeDebitNotes,
        skip_cancelled: skipCancelled,
        purchase_cu_source: purchaseCuSource,
        kra_csv_pin_column: kraPinCol,
        kra_csv_partner_name_column: kraPartnerCol,
        kra_csv_invoice_number_column: kraInvNoCol,
        kra_csv_invoice_date_column: kraDateCol,
        kra_csv_cu_number_column: kraCuCol,
        kra_csv_vat_group_column: kraVatCol,
        kra_csv_base_amount_column: kraBaseCol,
        version: settings.version,
        reason: reason.trim() || undefined,
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

      setReason("");
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
            <Sliders className="w-5 h-5 text-indigo-400" />
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

        {/* Ingestion Flags */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Document Ingestion & Filter Controls
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={ignoreMissingCu}
                onChange={(e) => setIgnoreMissingCu(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">Ingest Invoices Missing Control Unit (CU)</span>
                <span className="text-[11px] text-slate-500 block">
                  Assigns MISSING_CU_NUMBER status instead of excluding from session.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={skipCancelled}
                onChange={(e) => setSkipCancelled(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">Automatically Skip Cancelled SAP Documents</span>
                <span className="text-[11px] text-slate-500 block">
                  Excludes SAP documents marked as Cancelled (Cancelled = tYES).
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={includeCreditNotes}
                onChange={(e) => setIncludeCreditNotes(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">Include SAP Credit Notes</span>
                <span className="text-[11px] text-slate-500 block">
                  Ingests A/R and A/P Credit Memos into reconciliation matches.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={includeDebitNotes}
                onChange={(e) => setIncludeDebitNotes(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">Include SAP Debit Notes</span>
                <span className="text-[11px] text-slate-500 block">
                  Ingests Debit Notes during transaction processing.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* KRA CSV Column Mapping */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            KRA CSV Column Indexes (0-based)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">PIN Number</label>
              <input type="number" min={0} value={kraPinCol} onChange={(e) => setKraPinCol(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Partner Name</label>
              <input type="number" min={0} value={kraPartnerCol} onChange={(e) => setKraPartnerCol(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Invoice Number</label>
              <input type="number" min={0} value={kraInvNoCol} onChange={(e) => setKraInvNoCol(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Invoice Date</label>
              <input type="number" min={0} value={kraDateCol} onChange={(e) => setKraDateCol(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">CU Number</label>
              <input type="number" min={0} value={kraCuCol} onChange={(e) => setKraCuCol(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">VAT Group</label>
              <input type="number" min={0} value={kraVatCol} onChange={(e) => setKraVatCol(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Base Amount</label>
              <input type="number" min={0} value={kraBaseCol} onChange={(e) => setKraBaseCol(parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
          </div>
        </div>

        {/* Change Rationale Input (Audit requirement) */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-500" />
            Reason for Configuration Change (Audit Note)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Updated threshold per Q3 tax compliance review"
            className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Operational Rules
          </button>
        </div>
      </form>
    </div>
  );
}
