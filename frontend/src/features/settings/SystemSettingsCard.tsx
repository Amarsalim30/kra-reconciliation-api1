"use client";

import { useState } from "react";
import { BaseAmountPolicy, SystemSettings, UnmappedVatPolicy, KRASectionConfig } from "@/types/settings";
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
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileCode,
  CheckSquare,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
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
  const [reason, setReason] = useState("");

  const [sectionMappings, setSectionMappings] = useState<Record<string, KRASectionConfig>>(
    settings.kra_section_mappings || {}
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const numericTolerance = parseFloat(amountTolerance) || 0;
  const showToleranceWarning = numericTolerance > 1000.0;

  const toggleSectionExpand = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const updateSectionField = (id: string, field: keyof KRASectionConfig, value: any) => {
    setSectionMappings((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const updateColumnMappingField = (
    id: string,
    field: keyof KRASectionConfig["column_mapping"],
    value: any
  ) => {
    setSectionMappings((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        column_mapping: {
          ...prev[id].column_mapping,
          [field]: value === "" ? null : Number(value),
        },
      },
    }));
  };

  const updateValidationRuleField = (
    id: string,
    field: keyof KRASectionConfig["validation_rules"],
    value: boolean
  ) => {
    setSectionMappings((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        validation_rules: {
          ...prev[id].validation_rules,
          [field]: value,
        },
      },
    }));
  };

  const handleAddSection = () => {
    const newId = `SEC_CUSTOM_${Date.now()}`;
    const newSection: KRASectionConfig = {
      identifier: newId,
      module: "purchases",
      display_name: "New Custom Section",
      filename_regex: `(?i).*sec[_-]?custom.*`,
      vat_group: "16",
      required: false,
      column_mapping: {
        pin: 0,
        partner_name: 1,
        invoice_number: 2,
        invoice_date: 3,
        cu_number: 4,
        base_amount: 5,
        vat_group: null,
      },
      validation_rules: {
        pin_required: true,
        allow_negative_amounts: false,
      },
      active: true,
    };

    setSectionMappings((prev) => ({
      ...prev,
      [newId]: newSection,
    }));
    setExpandedSection(newId);
  };

  const handleDeleteSection = (id: string) => {
    setSectionMappings((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (expandedSection === id) {
      setExpandedSection(null);
    }
  };

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
        kra_section_mappings: sectionMappings,
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
      setSuccessMessage("Operational reconciliation rules and section mappings updated successfully!");
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

        {/* KRA Section Mappings Editor */}
        <div className="space-y-4 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                KRA CSV Section Ingestion & Filename Routing Mappings
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Define regex rules to dynamically detect KRA sections from uploaded files and configure index column mappings.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddSection}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Custom Section
            </button>
          </div>

          <div className="space-y-3">
            {Object.entries(sectionMappings).map(([id, mapping]) => {
              const isExpanded = expandedSection === id;
              const isBuiltIn = ["SEC_B", "SEC_F", "SEC_G", "SEC_H", "SEC_I"].includes(id);

              return (
                <div
                  key={id}
                  className={`rounded-xl border transition-all ${
                    mapping.active
                      ? "bg-slate-50 border-slate-200"
                      : "bg-slate-100/50 border-slate-200 opacity-75"
                  }`}
                >
                  {/* Card Header */}
                  <div
                    onClick={() => toggleSectionExpand(id)}
                    className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                        <FileCode className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">
                            {mapping.display_name || id}
                          </span>
                          <span className="text-[10px] font-mono bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded">
                            {id}
                          </span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                            mapping.module === "sales" 
                              ? "bg-blue-50 border border-blue-200 text-blue-700" 
                              : "bg-purple-50 border border-purple-200 text-purple-700"
                          }`}>
                            {mapping.module === "sales" ? "Sales" : "Purchases"}
                          </span>
                          {mapping.required && (
                            <span className="text-[9px] font-semibold bg-rose-50 border border-rose-200 text-rose-700 px-1.5 py-0.5 rounded">
                              Required
                            </span>
                          )}
                          {!mapping.active && (
                            <span className="text-[9px] font-semibold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                          Regex: {mapping.filename_regex} → VAT Group: {mapping.vat_group}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      {/* Active switch */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mapping.active}
                          onChange={(e) => updateSectionField(id, "active", e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-slate-600">Active</span>
                      </label>

                      {/* Required checkbox */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mapping.required}
                          onChange={(e) => updateSectionField(id, "required", e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-slate-600">Required</span>
                      </label>

                      {/* Delete for custom sections */}
                      {!isBuiltIn && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(id)}
                          className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition-colors"
                          title="Delete Custom Section"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Expand / Collapse Button */}
                      <button
                        type="button"
                        onClick={() => toggleSectionExpand(id)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Card Content (Expanded) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-200/60 bg-white rounded-b-xl space-y-4">
                      {/* Basic configuration fields */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={mapping.display_name}
                            onChange={(e) => updateSectionField(id, "display_name", e.target.value)}
                            required
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Filename Regex Pattern
                          </label>
                          <input
                            type="text"
                            value={mapping.filename_regex}
                            onChange={(e) => updateSectionField(id, "filename_regex", e.target.value)}
                            required
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Target VAT Group
                          </label>
                          <input
                            type="text"
                            value={mapping.vat_group}
                            onChange={(e) => updateSectionField(id, "vat_group", e.target.value)}
                            required
                            placeholder="e.g. 16"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Reconciliation Module
                          </label>
                          <select
                            value={mapping.module}
                            onChange={(e) => updateSectionField(id, "module", e.target.value)}
                            disabled={isBuiltIn}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-100 disabled:text-slate-500"
                          >
                            <option value="sales">Sales</option>
                            <option value="purchases">Purchases</option>
                          </select>
                        </div>
                      </div>

                      {/* Advanced index mappings */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          CSV Column Index Mappings (0-Indexed)
                        </span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">PIN Column</label>
                            <input
                              type="number"
                              min="0"
                              value={mapping.column_mapping.pin}
                              onChange={(e) => updateColumnMappingField(id, "pin", e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">Partner/Name Column</label>
                            <input
                              type="number"
                              min="0"
                              value={mapping.column_mapping.partner_name}
                              onChange={(e) => updateColumnMappingField(id, "partner_name", e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">Invoice Number Column</label>
                            <input
                              type="number"
                              min="0"
                              value={mapping.column_mapping.invoice_number}
                              onChange={(e) => updateColumnMappingField(id, "invoice_number", e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">Invoice Date Column</label>
                            <input
                              type="number"
                              min="0"
                              value={mapping.column_mapping.invoice_date}
                              onChange={(e) => updateColumnMappingField(id, "invoice_date", e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">CU Number Column</label>
                            <input
                              type="number"
                              min="0"
                              value={mapping.column_mapping.cu_number}
                              onChange={(e) => updateColumnMappingField(id, "cu_number", e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">Base Amount Column</label>
                            <input
                              type="number"
                              min="0"
                              value={mapping.column_mapping.base_amount}
                              onChange={(e) => updateColumnMappingField(id, "base_amount", e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-slate-500">VAT Group Column (Optional)</label>
                            <input
                              type="number"
                              min="0"
                              value={mapping.column_mapping.vat_group ?? ""}
                              placeholder="Default from section"
                              onChange={(e) => updateColumnMappingField(id, "vat_group", e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Validation rules */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          Validation Policies
                        </span>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={mapping.validation_rules.pin_required}
                              onChange={(e) => updateValidationRuleField(id, "pin_required", e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-700">Validate PIN presence (Fail row if blank)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded border border-slate-200 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={mapping.validation_rules.allow_negative_amounts}
                              onChange={(e) => updateValidationRuleField(id, "allow_negative_amounts", e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-700">Allow negative base amounts (Credit memo styles)</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
