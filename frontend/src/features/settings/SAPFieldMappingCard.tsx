"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/lib/api";
import {
  SAPFieldMapping,
  VatModule,
  InternalField,
  SourceType,
  TransformationType,
  PreviewResponse,
  SampleDocumentShort,
} from "@/types/settings";
import {
  Sliders,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Play,
  FileJson,
  HelpCircle,
  Eye,
  Settings,
  ArrowUpDown,
  BookOpen,
} from "lucide-react";

interface SAPFieldMappingCardProps {
  settingsVersion: number;
  onSaved: () => void;
}

const COMMON_SAP_FIELDS = [
  "DocNum",
  "CardName",
  "FederalTaxID",
  "DocDate",
  "U_CUINV",
  "NumAtCard",
  "U_CUSerial",
  "LineTotal",
  "VatGroup",
  "PaymentReference",
  "EDocNum",
  "Reference1",
  "Reference2",
  "Comments",
];

const FIELD_LABELS: Record<InternalField, { label: string; desc: string; defaultSource: SourceType }> = {
  invoice_number: { label: "Invoice Number", desc: "Target SAP field containing the document reference/internal ID", defaultSource: "HEADER" },
  partner_name: { label: "Partner/Customer Name", desc: "SAP field storing the card name / vendor or customer name", defaultSource: "HEADER" },
  invoice_date: { label: "Invoice Date", desc: "SAP field containing the posting / document date", defaultSource: "HEADER" },
  pin: { label: "Tax PIN", desc: "SAP field containing Federal Tax ID / PIN of the partner", defaultSource: "HEADER" },
  cu_number: { label: "KRA CU Number", desc: "SAP custom field or vendor ref field storing the control unit invoice number", defaultSource: "HEADER" },
  cu_serial: { label: "CU Serial", desc: "SAP field containing fiscal device serial / control unit serial", defaultSource: "HEADER" },
  base_amount: { label: "Base Amount (LineTotal)", desc: "SAP document line field representing the taxable amount", defaultSource: "LINE" },
  vat_group: { label: "VAT Group", desc: "SAP document line field representing the VAT tax code", defaultSource: "LINE" },
};

export function SAPFieldMappingCard({ settingsVersion, onSaved }: SAPFieldMappingCardProps) {
  const [mappings, setMappings] = useState<SAPFieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  
  // Navigation
  const [activeModule, setActiveModule] = useState<VatModule>("purchases");
  const [expandedField, setExpandedField] = useState<InternalField | null>("cu_number");

  // Testing & Previewer state
  const [sampleDocs, setSampleDocs] = useState<SampleDocumentShort[]>([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [selectedDocEntry, setSelectedDocEntry] = useState<string>("");
  const [sampleJson, setSampleJson] = useState<string>("{\n  \"DocNum\": 1001,\n  \"CardName\": \"Sample Partner\",\n  \"FederalTaxID\": \"P000000000A\",\n  \"DocDate\": \"2026-03-02\",\n  \"U_CUINV\": \"KRA12345/678\",\n  \"NumAtCard\": \"KRA12345/678\",\n  \"DocumentLines\": [\n    {\n      \"LineTotal\": 10000.00,\n      \"VatGroup\": \"O1\"\n    }\n  ]\n}");
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/settings/sap-field-mappings");
      if (!res.ok) throw new Error("Failed to load SAP field mappings.");
      const data = await res.json();
      setMappings(data);
    } catch (err: any) {
      setError(err.message || "An error occurred loading mappings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  // Load Recent Samples from SAP
  const fetchSamples = async () => {
    setLoadingSamples(true);
    setPreviewError(null);
    try {
      const res = await fetchWithAuth(`/settings/sap-field-mappings/sample-documents?module=${activeModule}`);
      if (!res.ok) throw new Error("Failed to connect to SAP Service Layer to retrieve samples.");
      const docs = await res.json();
      setSampleDocs(docs);
      if (docs.length > 0) {
        setSelectedDocEntry(String(docs[0].docEntry));
        fetchSampleDetail(docs[0].docEntry);
      }
    } catch (err: any) {
      setPreviewError(err.message || "Failed to load SAP samples.");
    } finally {
      setLoadingSamples(false);
    }
  };

  const fetchSampleDetail = async (entry: number) => {
    setPreviewLoading(true);
    try {
      const res = await fetchWithAuth(`/settings/sap-field-mappings/sample-document/${entry}?module=${activeModule}`);
      if (!res.ok) throw new Error("Failed to load document JSON details from SAP.");
      const doc = await res.json();
      setSampleJson(JSON.stringify(doc, null, 2));
    } catch (err: any) {
      setPreviewError(err.message || "Failed to load sample detail.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSampleDocChange = (entryStr: string) => {
    setSelectedDocEntry(entryStr);
    if (entryStr) {
      fetchSampleDetail(Number(entryStr));
    }
  };

  // Run Draft Preview
  const runPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewResult(null);
    try {
      let parsedDoc;
      try {
        parsedDoc = JSON.parse(sampleJson);
      } catch (e) {
        throw new Error("Invalid Sample Document JSON. Please correct the syntax.");
      }

      // Filter draft mappings for the active module to send
      const activeDraftMappings = mappings.filter((m) => m.module === activeModule);

      const res = await fetchWithAuth("/settings/sap-field-mappings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sample_document: parsedDoc,
          mappings: activeDraftMappings,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to run preview mapping.");
      }

      const result = await res.json();
      setPreviewResult(result);
    } catch (err: any) {
      setPreviewError(err.message || "An error occurred running preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // CRUD Actions
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetchWithAuth("/settings/sap-field-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings,
          reason: reason.trim() || undefined,
          settings_version: settingsVersion,
        }),
      });

      if (res.status === 409) {
        const errData = await res.json();
        throw new Error(errData.detail || "Conflict: Mappings modified by another administrator.");
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save mappings.");
      }

      setSuccess("SAP Field mappings updated successfully!");
      setReason("");
      onSaved();
      loadMappings();
    } catch (err: any) {
      setError(err.message || "An error occurred saving mappings.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to restore mapping configurations to defaults? This will erase custom rules.")) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetchWithAuth("/settings/sap-field-mappings/reset", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset mappings.");
      setSuccess("Mappings restored to default parameters.");
      loadMappings();
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to reset.");
    } finally {
      setLoading(false);
    }
  };

  const updateMappingField = (index: number, field: keyof SAPFieldMapping, value: any) => {
    setMappings((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddSource = (fieldName: InternalField) => {
    const activeFieldMappings = mappings.filter(
      (m) => m.module === activeModule && m.internal_field === fieldName
    );
    const nextPriority = activeFieldMappings.length + 1;
    const defaultSource = FIELD_LABELS[fieldName].defaultSource;

    const newMapping: SAPFieldMapping = {
      module: activeModule,
      internal_field: fieldName,
      source_type: defaultSource,
      priority: nextPriority,
      sap_field: "",
      transformation: "NONE",
      is_enabled: true,
    };

    setMappings((prev) => [...prev, newMapping]);
  };

  const handleDeleteSource = (indexToDelete: number) => {
    const mappingToDelete = mappings[indexToDelete];
    setMappings((prev) => {
      // Remove item
      const filtered = prev.filter((_, idx) => idx !== indexToDelete);
      // Re-index priorities for the same field
      let prio = 1;
      return filtered.map((m) => {
        if (
          m.module === mappingToDelete.module &&
          m.internal_field === mappingToDelete.internal_field
        ) {
          const reindexed = { ...m, priority: prio };
          prio++;
          return reindexed;
        }
        return m;
      });
    });
  };

  const movePriority = (index: number, direction: "up" | "down") => {
    const current = mappings[index];
    const siblings = mappings.filter(
      (m) => m.module === current.module && m.internal_field === current.internal_field
    ).sort((a, b) => a.priority - b.priority);

    const currentIndexInSiblings = siblings.findIndex((s) => s.priority === current.priority);
    if (currentIndexInSiblings === -1) return;

    let targetIndexInSiblings = direction === "up" ? currentIndexInSiblings - 1 : currentIndexInSiblings + 1;
    if (targetIndexInSiblings < 0 || targetIndexInSiblings >= siblings.length) return;

    const target = siblings[targetIndexInSiblings];

    // Swap priorities
    setMappings((prev) =>
      prev.map((m) => {
        if (m.module === current.module && m.internal_field === current.internal_field) {
          if (m.priority === current.priority) return { ...m, priority: target.priority };
          if (m.priority === target.priority) return { ...m, priority: current.priority };
        }
        return m;
      })
    );
  };

  // Helper to filter mappings of current active module & internal field
  const getFieldMappings = (fieldName: InternalField) => {
    return mappings
      .map((m, originalIndex) => ({ ...m, originalIndex }))
      .filter((m) => m.module === activeModule && m.internal_field === fieldName)
      .sort((a, b) => a.priority - b.priority);
  };

  // Synced regex handler (validates by internal field as requested)
  const getFieldValidationRegex = (fieldName: InternalField) => {
    const fieldMap = mappings.find(
      (m) => m.module === activeModule && m.internal_field === fieldName && m.validation_regex
    );
    return fieldMap?.validation_regex || "";
  };

  const setFieldValidationRegex = (fieldName: InternalField, regexVal: string) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.module === activeModule && m.internal_field === fieldName) {
          return { ...m, validation_regex: regexVal || null };
        }
        return m;
      })
    );
  };

  const getFieldDescription = (fieldName: InternalField) => {
    const fieldMap = mappings.find(
      (m) => m.module === activeModule && m.internal_field === fieldName && m.description
    );
    return fieldMap?.description || "";
  };

  const setFieldDescription = (fieldName: InternalField, descVal: string) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.module === activeModule && m.internal_field === fieldName) {
          return { ...m, description: descVal || null };
        }
        return m;
      })
    );
  };

  if (loading && mappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-3" />
        <span className="text-sm font-semibold text-slate-600">Retrieving SAP Ingestion Rules...</span>
      </div>
    );
  }

  // Active fields for current module
  const activeFields: InternalField[] =
    activeModule === "sales"
      ? ["invoice_number", "partner_name", "invoice_date", "pin", "cu_number", "base_amount", "vat_group"]
      : ["invoice_number", "partner_name", "invoice_date", "pin", "cu_number", "cu_serial", "base_amount", "vat_group"];

  return (
    <div className="space-y-6">
      {/* Messages Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="font-semibold">{success}</div>
        </div>
      )}

      {/* Main configuration structure */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header bar */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
              <Sliders className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">SAP Document Extraction Engine</h2>
              <p className="text-xs text-slate-400">
                Normalize different client SAP schema structures using priority field overrides.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Factory Defaults
          </button>
        </div>

        {/* Tab Module toggle */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              setActiveModule("purchases");
              setExpandedField("cu_number");
            }}
            className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-all ${
              activeModule === "purchases"
                ? "border-amber-600 text-amber-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Purchase Invoices mapping
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveModule("sales");
              setExpandedField("cu_number");
            }}
            className={`flex-1 py-3 text-center text-sm font-bold border-b-2 transition-all ${
              activeModule === "sales"
                ? "border-amber-600 text-amber-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Sales Invoices mapping
          </button>
        </div>

        {/* Accordions */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="space-y-3">
            {activeFields.map((fieldName) => {
              const fieldMeta = FIELD_LABELS[fieldName];
              const fieldRules = getFieldMappings(fieldName);
              const isExpanded = expandedField === fieldName;

              return (
                <div
                  key={fieldName}
                  className={`border rounded-lg overflow-hidden transition-all duration-200 ${
                    isExpanded
                      ? "border-amber-200 shadow-md shadow-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Header */}
                  <div
                    onClick={() => setExpandedField(isExpanded ? null : fieldName)}
                    className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                      isExpanded ? "bg-amber-50/40" : "bg-white"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{fieldMeta.label}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 rounded-md text-slate-500 border border-slate-200">
                          {fieldRules[0]?.source_type || fieldMeta.defaultSource}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{fieldMeta.desc}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-400 font-mono">
                        {fieldRules.length} Priority sources
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  {isExpanded && (
                    <div className="p-5 bg-white border-t border-slate-100 space-y-4">
                      {/* Shared Rules: Description Notes & Validation Regex */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">
                            Validation Regex Pattern
                          </label>
                          <input
                            type="text"
                            value={getFieldValidationRegex(fieldName)}
                            onChange={(e) => setFieldValidationRegex(fieldName, e.target.value)}
                            placeholder="e.g. ^(KRA[A-Z0-9]{11,17}/\d+|\d{15,25})$"
                            className="w-full text-xs px-3 py-2 border rounded-lg font-mono focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">
                            Configuration Mapping Notes (Description)
                          </label>
                          <input
                            type="text"
                            value={getFieldDescription(fieldName)}
                            onChange={(e) => setFieldDescription(fieldName, e.target.value)}
                            placeholder="Describe how client stores this field..."
                            className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Mapping Sources List */}
                      {fieldRules.length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-lg text-slate-400 text-xs">
                          No priority fields configured. Ingestion will fail to extract this value.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {fieldRules.map((rule, sIdx) => (
                            <div
                              key={sIdx}
                              className={`flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl border transition-all ${
                                rule.is_enabled ? "bg-slate-50/50 border-slate-200" : "bg-slate-100/50 border-slate-200 opacity-65"
                              }`}
                            >
                              {/* Re-order & Toggle */}
                              <div className="flex items-center gap-2 md:shrink-0">
                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center font-mono">
                                  {rule.priority}
                                </span>
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    disabled={sIdx === 0}
                                    onClick={() => movePriority(rule.originalIndex, "up")}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={sIdx === fieldRules.length - 1}
                                    onClick={() => movePriority(rule.originalIndex, "down")}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Target Field Select */}
                              <div className="flex-1 min-w-[150px]">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  SAP JSON Field
                                </label>
                                <input
                                  type="text"
                                  list={`sap-fields-${fieldName}`}
                                  value={rule.sap_field}
                                  onChange={(e) => updateMappingField(rule.originalIndex, "sap_field", e.target.value)}
                                  placeholder="e.g. NumAtCard"
                                  className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-amber-500"
                                />
                                <datalist id={`sap-fields-${fieldName}`}>
                                  {COMMON_SAP_FIELDS.map((f) => (
                                    <option key={f} value={f} />
                                  ))}
                                </datalist>
                              </div>

                              {/* Source Location Type */}
                              <div className="w-[110px] shrink-0">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Source Type
                                </label>
                                <select
                                  value={rule.source_type}
                                  onChange={(e) => updateMappingField(rule.originalIndex, "source_type", e.target.value)}
                                  className="w-full text-xs px-2.5 py-2 border rounded-lg bg-white focus:ring-1 focus:ring-amber-500"
                                >
                                  <option value="HEADER">Header</option>
                                  <option value="LINE">Line</option>
                                </select>
                              </div>

                              {/* Transformation Select */}
                              <div className="min-w-[130px] flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Transformation
                                </label>
                                <select
                                  value={rule.transformation}
                                  onChange={(e) => updateMappingField(rule.originalIndex, "transformation", e.target.value)}
                                  className="w-full text-xs px-2.5 py-2 border rounded-lg bg-white focus:ring-1 focus:ring-amber-500"
                                >
                                  <option value="NONE">None</option>
                                  <option value="BEFORE_SLASH">Before Slash ("/")</option>
                                  <option value="AFTER_SLASH">After Slash ("/")</option>
                                  <option value="REGEX">Regex Extract Group</option>
                                  <option value="REGEX_REPLACE">Regex Replace</option>
                                  <option value="TRIM">Trim whitespace</option>
                                  <option value="UPPERCASE">Uppercase</option>
                                  <option value="LOWERCASE">Lowercase</option>
                                </select>
                              </div>

                              {/* Transformation Value Parameter */}
                              {["REGEX", "REGEX_REPLACE"].includes(rule.transformation) && (
                                <div className="flex-1 min-w-[140px]">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                    {rule.transformation === "REGEX_REPLACE" ? "Pattern|Replacement" : "Regex Pattern Group"}
                                  </label>
                                  <input
                                    type="text"
                                    value={rule.transformation_value || ""}
                                    onChange={(e) => updateMappingField(rule.originalIndex, "transformation_value", e.target.value)}
                                    placeholder={rule.transformation === "REGEX_REPLACE" ? "pattern|replacement" : "e.g. (\\d{15,25})"}
                                    className="w-full text-xs px-3 py-2 border rounded-lg font-mono focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                              )}

                              {/* Active Checkbox */}
                              <div className="flex items-center gap-1.5 shrink-0 pt-3 md:pt-0">
                                <input
                                  type="checkbox"
                                  id={`enabled-${rule.originalIndex}`}
                                  checked={rule.is_enabled}
                                  onChange={(e) => updateMappingField(rule.originalIndex, "is_enabled", e.target.checked)}
                                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                />
                                <label htmlFor={`enabled-${rule.originalIndex}`} className="text-xs font-semibold text-slate-600 cursor-pointer">
                                  Enabled
                                </label>
                              </div>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteSource(rule.originalIndex)}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-colors md:self-end md:mb-0.5 shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add button */}
                      <button
                        type="button"
                        onClick={() => handleAddSource(fieldName)}
                        className="py-2 px-3.5 border border-dashed border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all w-full md:w-auto"
                      >
                        <Plus className="w-4 h-4" />
                        Add Priority Field
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reason & Submit section */}
          <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-end justify-between gap-4">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Reason for mapping updates (audit trail log)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Configured custom CU Number field for Client Naivas"
                className="w-full text-xs px-3.5 py-2 border rounded-lg focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-colors w-full md:w-auto justify-center"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Save className="w-4 h-4 text-white" />
              )}
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* Mapping Tester Previewer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <Eye className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Field Extraction Dry Run & Testing</h3>
            <p className="text-xs text-slate-500">
              Run and preview extraction diagnostics on a sample SAP document using your current configurations above.
            </p>
          </div>
        </div>

        {/* Loading samples panel */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fetchSamples}
            disabled={loadingSamples}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border"
          >
            {loadingSamples ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5" />
            )}
            Load Recent Documents from SAP
          </button>

          {sampleDocs.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <select
                value={selectedDocEntry}
                onChange={(e) => handleSampleDocChange(e.target.value)}
                className="w-full text-xs px-3 py-2 border rounded-lg bg-white"
              >
                {sampleDocs.map((doc) => (
                  <option key={doc.docEntry} value={doc.docEntry}>
                    DocEntry {doc.docEntry} (DocNum: {doc.docNum}) - {doc.cardName || "No Name"} ({doc.docDate})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sample JSON Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileJson className="w-4 h-4 text-slate-500" />
              Raw SAP Document Payload (JSON)
            </label>
            <textarea
              value={sampleJson}
              onChange={(e) => setSampleJson(e.target.value)}
              rows={12}
              className="w-full text-xs p-4 border rounded-xl font-mono bg-slate-50 border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all focus:outline-none"
            />
            {previewError && (
              <p className="text-xs text-rose-600 font-semibold">{previewError}</p>
            )}
            <button
              type="button"
              onClick={runPreview}
              disabled={previewLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {previewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Play className="w-4 h-4 fill-white text-white" />
              )}
              Execute Draft Preview
            </button>
          </div>

          {/* Test Results Output */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-slate-500" />
              Diagnostics Extraction Report
            </h4>

            {!previewResult ? (
              <div className="h-[300px] border border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 p-6 text-center text-xs">
                <Sliders className="w-10 h-10 text-slate-300 mb-2" />
                Click "Execute Draft Preview" to evaluate mapping rules and view step-by-step extraction paths.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-[360px] overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Internal Field</th>
                      <th className="px-4 py-3">Extracted Value</th>
                      <th className="px-4 py-3">Diagnostics & Steps Log</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {activeFields.map((field) => {
                      const res = previewResult.mapped_values[field];
                      const label = FIELD_LABELS[field].label;
                      const hasWarning = res && res.warnings.length > 0;

                      return (
                        <tr key={field} className={hasWarning ? "bg-amber-50/20" : ""}>
                          <td className="px-4 py-3.5 font-bold text-slate-800 align-top">
                            {label}
                          </td>
                          <td className="px-4 py-3.5 font-mono align-top">
                            {res?.value ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[11px]">
                                {res.value}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                                null / empty
                              </span>
                            )}
                            {hasWarning && (
                              <div className="text-[10px] text-amber-700 mt-1 flex items-start gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>Regex failed</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="space-y-1">
                              {res?.diagnostics.map((diag, dIdx) => (
                                <div key={dIdx} className="text-[11px] flex items-center gap-1.5">
                                  <span className="font-mono text-slate-400">{diag.priority}.</span>
                                  <span className="font-semibold text-slate-600">{diag.sap_field}:</span>
                                  {diag.status === "found" && (
                                    <span className="text-emerald-600 font-bold">Found ✓</span>
                                  )}
                                  {diag.status === "empty" && (
                                    <span className="text-slate-400">Empty</span>
                                  )}
                                  {diag.status === "disabled" && (
                                    <span className="text-slate-400 italic">Disabled</span>
                                  )}
                                  {diag.status === "failed_validation" && (
                                    <span className="text-amber-600 font-semibold">Matched but Failed Regex ⚠</span>
                                  )}
                                </div>
                              ))}
                              {(!res || res.diagnostics.length === 0) && (
                                <span className="text-slate-400 italic">No rules active</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
