"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Check, X, AlertTriangle, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { Invoice, ReconciliationResult, ReconciliationSummary } from "../types";

const formatVatGroup = (vat?: string) => {
  if (!vat) return "";
  const value = vat.trim();
  return /^\d+(\.\d+)?$/.test(value) ? `${value}%` : value;
};

const formatNumeric = (val: string | number | undefined | null) => {
  if (val === null || val === undefined || val === "") return "-";
  if (typeof val === "number" || !isNaN(Number(val))) {
    return Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(val);
};

interface ResultsTableProps {
  results: ReconciliationResult[];
  summary: ReconciliationSummary | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

type FilterType = "All" | "Issues" | "Matches" | "Missing SAP" | "Missing KRA" | "Amount" | "VAT" | "Date" | "Multiple";
type SortField = "pin" | "invoice_number" | "invoice_date" | "base_amount" | "vat_group" | "status";
type SortOrder = "asc" | "desc" | null;

function CompareCell({
  sapVal,
  kraVal,
  isMatch,
  isMissingSap,
  isMissingKra,
  isNumeric = false,
}: {
  sapVal?: string | number;
  kraVal?: string | number;
  isMatch: boolean;
  isMissingSap: boolean;
  isMissingKra: boolean;
  isNumeric?: boolean;
}) {
  const s = isNumeric ? formatNumeric(sapVal) : String(sapVal || "-");
  const k = isNumeric ? formatNumeric(kraVal) : String(kraVal || "-");

  if (isMatch) return <span className="text-slate-800">{s}</span>;

  if (isMissingSap) return <span className="text-red-600 font-medium">{k}</span>;
  if (isMissingKra) return <span className="text-red-600 font-medium">{s}</span>;

  return (
    <div className="flex flex-col text-xs leading-tight">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 w-8">SAP:</span>
        <span className="text-slate-800 font-medium text-right">{s}</span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-slate-500 w-8">KRA:</span>
        <span className="text-slate-800 font-medium text-right">{k}</span>
      </div>
      <div className="text-amber-600 mt-1 font-medium flex items-center justify-end gap-1">
        <AlertTriangle className="w-3 h-3" />
        Difference
      </div>
    </div>
  );
}

function InformationalCell({
  sapVal,
  kraVal,
  hasDiff,
  isMissingSapRecord,
  isMissingKraRecord,
  isName = false,
}: {
  sapVal?: string;
  kraVal?: string;
  hasDiff: boolean;
  isMissingSapRecord: boolean;
  isMissingKraRecord: boolean;
  isName?: boolean;
}) {
  const s = sapVal?.trim() || "Not available";
  const k = kraVal?.trim() || "Not available";

  if (isMissingSapRecord) return <span className="text-red-600 font-medium truncate block max-w-[150px]" title={k}>{k}</span>;
  if (isMissingKraRecord) return <span className="text-red-600 font-medium truncate block max-w-[150px]" title={s}>{s}</span>;

  if (!hasDiff) {
    const displayVal = sapVal?.trim() ? sapVal.trim() : (kraVal?.trim() || (isName ? "-" : "Not available"));
    return <span className="text-slate-800 truncate block max-w-[150px]" title={displayVal}>{displayVal}</span>;
  }

  return (
    <div className="flex flex-col text-xs leading-tight">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 w-8">SAP:</span>
        <span className="text-slate-800 font-medium text-right truncate max-w-[110px]" title={s}>{s}</span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-slate-500 w-8">KRA:</span>
        <span className="text-slate-800 font-medium text-right truncate max-w-[110px]" title={k}>{k}</span>
      </div>
      <div className="text-amber-600 mt-1 font-medium flex items-center justify-end gap-1">
        <AlertTriangle className="w-3 h-3" />
        Diff
      </div>
    </div>
  );
}

export function ResultsTable({
  results,
  summary,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: ResultsTableProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [filter, setFilter] = useState<FilterType>("All");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) onLoadMore();
    }, { threshold: 0.1 });
    const currentSentinel = sentinelRef.current;
    if (currentSentinel) observer.observe(currentSentinel);
    return () => { if (currentSentinel) observer.unobserve(currentSentinel); };
  }, [onLoadMore, hasMore, isLoadingMore]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === "asc") setSortOrder("desc");
      else if (sortOrder === "desc") { setSortField(null); setSortOrder(null); }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const st = r.status;
      if (filter === "All") return true;
      if (filter === "Matches") return st === "MATCH" || st === "Matched" || st === "Match";
      if (filter === "Issues") return st !== "MATCH" && st !== "Matched" && st !== "Match";
      if (filter === "Missing SAP") return st === "MISSING_IN_SAP" || st === "Missing in SAP";
      if (filter === "Missing KRA") return st === "MISSING_IN_KRA" || st === "Missing in KRA";
      if (filter === "Amount") return st === "AMOUNT_MISMATCH";
      if (filter === "VAT") return st === "VAT_MISMATCH";
      if (filter === "Date") return st === "DATE_MISMATCH";
      if (filter === "Multiple") return st === "MULTIPLE_MISMATCHES" || st === "DUPLICATE_SOURCE_KEY";
      return true;
    });
  }, [results, filter]);

  const sortedResults = useMemo(() => {
    if (!sortField || !sortOrder) return filteredResults;
    return [...filteredResults].sort((a, b) => {
      let aVal: string | number | undefined | null = "";
      let bVal: string | number | undefined | null = "";
      
      const sapA = a.sap || {} as Partial<Invoice>;
      const kraA = a.kra || {} as Partial<Invoice>;
      const sapB = b.sap || {} as Partial<Invoice>;
      const kraB = b.kra || {} as Partial<Invoice>;

      // Default to SAP value for sorting unless it's missing
      const getVal = (sap: Partial<Invoice>, kra: Partial<Invoice>, field: keyof Invoice) => sap[field] || kra[field] || "";

      if (sortField === "pin") { aVal = getVal(sapA, kraA, "pin"); bVal = getVal(sapB, kraB, "pin"); }
      if (sortField === "invoice_number") { aVal = getVal(sapA, kraA, "invoice_number"); bVal = getVal(sapB, kraB, "invoice_number"); }
      if (sortField === "invoice_date") { aVal = getVal(sapA, kraA, "invoice_date"); bVal = getVal(sapB, kraB, "invoice_date"); }
      if (sortField === "base_amount") { 
        aVal = Number(sapA.base_amount || kraA.base_amount || 0); 
        bVal = Number(sapB.base_amount || kraB.base_amount || 0); 
      }
      if (sortField === "vat_group") { aVal = getVal(sapA, kraA, "vat_group"); bVal = getVal(sapB, kraB, "vat_group"); }
      if (sortField === "status") { aVal = a.status; bVal = b.status; }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredResults, sortField, sortOrder]);

  if (!results || results.length === 0) return null;

  const filters: FilterType[] = ["All", "Issues", "Matches", "Missing SAP", "Missing KRA", "Amount", "VAT", "Date", "Multiple"];
  const issuesCount = summary ? summary.total_sap + summary.total_kra - 2 * summary.matches : 0;

  return (
    <div className="flex flex-col">
      {/* Summary Header */}
      {summary && (
        <div className="mb-4 mt-2 text-sm font-medium text-slate-700 flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{summary.total_sap}</span> <span className="text-slate-500">SAP records</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-900">{summary.total_kra}</span> <span className="text-slate-500">KRA records</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-green-600 cursor-pointer hover:underline" onClick={() => setFilter("Matches")}>{summary.matches}</span> <span className="text-slate-500">matches</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-amber-600 cursor-pointer hover:underline" onClick={() => setFilter("Issues")}>{issuesCount}</span> <span className="text-slate-500">issues</span>
          </div>
        </div>
      )}

      {/* Segmented Filters */}
      <div className="flex px-2 mb-3">
        <div className="bg-slate-100 p-1 rounded-md flex inline-flex text-sm font-medium">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md transition-colors ${filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col border border-slate-200 bg-white shadow-sm overflow-hidden h-[700px] rounded-md">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 text-xs tracking-wider border-b border-slate-200 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="px-3 py-3 font-medium w-8 text-center bg-slate-50"></th>
                <th className="px-2 py-3 font-medium w-8 text-center bg-slate-50"></th>
                <th className="px-4 py-3 font-medium bg-slate-50 cursor-pointer select-none group" onClick={() => toggleSort("pin")}>
                  <div className="flex items-center gap-1">PIN <ArrowUpDown className={`w-3 h-3 ${sortField === "pin" ? "text-slate-900" : "text-slate-400 opacity-0 group-hover:opacity-100"}`} /></div>
                </th>
                <th className="px-4 py-3 font-medium bg-slate-50 cursor-pointer select-none group" onClick={() => toggleSort("invoice_number")}>
                  <div className="flex items-center gap-1">Invoice No <ArrowUpDown className={`w-3 h-3 ${sortField === "invoice_number" ? "text-slate-900" : "text-slate-400 opacity-0 group-hover:opacity-100"}`} /></div>
                </th>
                <th className="px-4 py-3 font-medium bg-slate-50">Partner Name</th>
                <th className="px-4 py-3 font-medium bg-slate-50 cursor-pointer select-none group" onClick={() => toggleSort("invoice_date")}>
                  <div className="flex items-center gap-1">Invoice Date <ArrowUpDown className={`w-3 h-3 ${sortField === "invoice_date" ? "text-slate-900" : "text-slate-400 opacity-0 group-hover:opacity-100"}`} /></div>
                </th>
                <th className="px-4 py-3 font-medium bg-slate-50">CU Number</th>
                <th className="px-4 py-3 font-medium text-right bg-slate-50 cursor-pointer select-none group" onClick={() => toggleSort("base_amount")}>
                  <div className="flex items-center justify-end gap-1">Base Amount <ArrowUpDown className={`w-3 h-3 ${sortField === "base_amount" ? "text-slate-900" : "text-slate-400 opacity-0 group-hover:opacity-100"}`} /></div>
                </th>
                <th className="px-4 py-3 font-medium text-right bg-slate-50 cursor-pointer select-none group" onClick={() => toggleSort("vat_group")}>
                  <div className="flex items-center justify-end gap-1">VAT Group <ArrowUpDown className={`w-3 h-3 ${sortField === "vat_group" ? "text-slate-900" : "text-slate-400 opacity-0 group-hover:opacity-100"}`} /></div>
                </th>
                <th className="px-4 py-3 font-medium bg-slate-50 cursor-pointer select-none group" onClick={() => toggleSort("status")}>
                  <div className="flex items-center gap-1">Remark <ArrowUpDown className={`w-3 h-3 ${sortField === "status" ? "text-slate-900" : "text-slate-400 opacity-0 group-hover:opacity-100"}`} /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedResults.map((r, idx) => {
                const isMatch = r.status === "Match" || r.status === "Matched" || r.status === "MATCH";
                const isMissingSap = r.status === "Missing in SAP" || r.status === "MISSING_IN_SAP";
                const isMissingKra = r.status === "Missing in KRA" || r.status === "MISSING_IN_KRA";
                
                const sap = r.sap || {} as Partial<Invoice>;
                const kra = r.kra || {} as Partial<Invoice>;
                const rowId = `${r.cu_number}-${idx}`;
                const isExpanded = expandedRows.has(rowId);

                let remark = r.status;
                let remarkColor = "text-slate-600";
                
                if (isMatch) {
                  remark = "Match";
                  remarkColor = "text-green-600";
                } else if (isMissingSap) {
                  remark = "Missing in SAP";
                  remarkColor = "text-red-600";
                } else if (isMissingKra) {
                  remark = "Missing in KRA";
                  remarkColor = "text-red-600";
                } else {
                  remarkColor = "text-amber-600";
                  if (r.status === "AMOUNT_MISMATCH") remark = "Amount Mismatch";
                  else if (r.status === "VAT_MISMATCH") remark = "VAT Mismatch";
                  else if (r.status === "DATE_MISMATCH") remark = "Date Mismatch";
                  else if (r.status === "MULTIPLE_MISMATCHES") remark = "Multiple Mismatches";
                  else if (r.status === "DUPLICATE_SOURCE_KEY") remark = "Duplicate MatchKey";
                }

                const pinHasDiff = !r.pin_matches;
                const nameHasDiff = !r.partner_name_matches;

                return (
                  <React.Fragment key={rowId}>
                    <tr 
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? "bg-slate-50" : "bg-white"}`}
                      onClick={() => toggleExpand(rowId)}
                    >
                      <td className="px-3 py-2 text-center align-middle">
                        <button className="text-slate-400 hover:text-slate-600 focus:outline-none">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-center align-middle">
                        {isMatch ? (
                          <Check className="w-4 h-4 text-green-600 inline-block" strokeWidth={3} />
                        ) : isMissingSap || isMissingKra ? (
                          <X className="w-4 h-4 text-red-600 inline-block" strokeWidth={3} />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500 inline-block" strokeWidth={2.5} />
                        )}
                      </td>
                      
                      <td className="px-4 py-2 font-mono align-middle">
                        <InformationalCell sapVal={sap.pin} kraVal={kra.pin} hasDiff={pinHasDiff} isMissingSapRecord={isMissingSap} isMissingKraRecord={isMissingKra} />
                      </td>
                      
                      <td className="px-4 py-2 font-mono align-middle">
                        <CompareCell sapVal={sap.invoice_number} kraVal={kra.invoice_number} isMatch={true} isMissingSap={isMissingSap} isMissingKra={isMissingKra} />
                      </td>
                      
                      <td className="px-4 py-2 align-middle">
                        <InformationalCell sapVal={sap.partner_name} kraVal={kra.partner_name} hasDiff={nameHasDiff} isMissingSapRecord={isMissingSap} isMissingKraRecord={isMissingKra} isName={true} />
                      </td>
                      
                      <td className="px-4 py-2 align-middle font-mono">
                        <CompareCell sapVal={sap.invoice_date} kraVal={kra.invoice_date} isMatch={r.date_match ?? isMatch} isMissingSap={isMissingSap} isMissingKra={isMissingKra} />
                      </td>
                      
                      <td className="px-4 py-2 font-mono text-slate-500 align-middle">
                        {r.cu_number || "-"}
                      </td>
                      
                      <td className="px-4 py-2 text-right font-mono align-middle">
                        <CompareCell sapVal={sap.base_amount} kraVal={kra.base_amount} isMatch={r.amount_match ?? isMatch} isMissingSap={isMissingSap} isMissingKra={isMissingKra} isNumeric={true} />
                      </td>
                      
                      <td className="px-4 py-2 text-right align-middle font-mono">
                        <CompareCell sapVal={formatVatGroup(sap.vat_group)} kraVal={formatVatGroup(kra.vat_group)} isMatch={r.vat_match ?? isMatch} isMissingSap={isMissingSap} isMissingKra={isMissingKra} />
                      </td>
                      
                      <td className={`px-4 py-2 font-medium align-middle ${remarkColor}`}>
                        {remark}
                      </td>
                    </tr>

                    {/* Expandable Details Grid */}
                    {isExpanded && (
                      <tr className="bg-slate-50 border-b border-slate-200 shadow-inner">
                        <td colSpan={10} className="p-0">
                          <div className="px-10 py-6 border-x border-slate-200 mx-4 my-2 bg-white rounded-md shadow-sm">
                            <div className="mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                Reconciliation Details
                              </h4>
                              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                                isMatch ? "bg-green-100 text-green-700" :
                                isMissingSap || isMissingKra ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                              }`}>
                                Status: {remark}
                              </span>
                            </div>
                            
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="text-left text-slate-500 border-b border-slate-200">
                                  <th className="font-medium py-2 w-1/4">Field</th>
                                  <th className="font-medium py-2 w-1/3">SAP</th>
                                  <th className="font-medium py-2 w-1/3">KRA</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {["PIN", "Invoice No", "Partner Name", "Invoice Date", "CU Number", "VAT Group", "Base Amount"].map((field) => {
                                  let sVal: string | number | undefined | null = "-"; let kVal: string | number | undefined | null = "-";
                                  let isFieldMatch = false;
                                  
                                  if (field === "PIN") { sVal = sap.pin?.trim() || "Not available"; kVal = kra.pin?.trim() || "Not available"; isFieldMatch = !pinHasDiff; }
                                  if (field === "Invoice No") { sVal = sap.invoice_number; kVal = kra.invoice_number; isFieldMatch = true; }
                                  if (field === "Partner Name") { sVal = sap.partner_name?.trim() || "Not available"; kVal = kra.partner_name?.trim() || "Not available"; isFieldMatch = !nameHasDiff; }
                                  if (field === "Invoice Date") { sVal = sap.invoice_date; kVal = kra.invoice_date; isFieldMatch = r.date_match ?? (sVal === kVal); }
                                  if (field === "CU Number") { sVal = sap.cu_number; kVal = kra.cu_number; isFieldMatch = sVal?.trim() === kVal?.trim(); }
                                  if (field === "VAT Group") { sVal = formatVatGroup(sap.vat_group); kVal = formatVatGroup(kra.vat_group); isFieldMatch = r.vat_match ?? (sVal === kVal); }
                                  if (field === "Base Amount") { sVal = sap.base_amount; kVal = kra.base_amount; isFieldMatch = r.amount_match ?? (sVal === kVal); }

                                  // Skip rows where both are null/empty
                                  if (!sVal && !kVal) return null;

                                  const highlightClass = !isFieldMatch && !isMissingSap && !isMissingKra ? "bg-amber-50" : "";
                                  const textClass = !isFieldMatch && !isMissingSap && !isMissingKra ? "text-amber-800 font-medium" : "text-slate-700";

                                  return (
                                    <tr key={field} className={highlightClass}>
                                      <td className="py-2.5 font-medium text-slate-600 px-2">{field}</td>
                                      <td className={`py-2.5 font-mono px-2 ${!sVal && isMissingSap ? "text-red-500 italic" : textClass}`}>
                                        {field.includes("Amount") ? formatNumeric(sVal) : String(sVal || "-")}
                                      </td>
                                      <td className={`py-2.5 font-mono px-2 ${!kVal && isMissingKra ? "text-red-500 italic" : textClass}`}>
                                        {field.includes("Amount") ? formatNumeric(kVal) : String(kVal || "-")}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>

                            {/* Show Numeric Difference for Amounts */}
                            {(!isMatch && !isMissingSap && !isMissingKra) && (
                              <div className="mt-4 pt-3 border-t border-slate-200 text-sm">
                                {sap.base_amount !== kra.base_amount && (
                                  <div className="flex items-center gap-2 text-amber-700 font-medium px-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Base Amount differs by {formatNumeric(Math.abs(Number(sap.base_amount || 0) - Number(kra.base_amount || 0)))}</span>
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Skeleton Loader Rows */}
              {isLoadingMore && (
                <>
                  {[...Array(3)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse bg-white border-b border-slate-100">
                      <td className="px-3 py-3"><div className="h-4 bg-slate-100 rounded w-4 mx-auto"></div></td>
                      <td className="px-2 py-3"><div className="h-4 bg-slate-100 rounded w-4 mx-auto"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-16 ml-auto"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-10 ml-auto"></div></td>
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          
          {/* Intersection Sentinel element */}
          {hasMore && <div ref={sentinelRef} className="h-4 w-full" />}
        </div>
      </div>
    </div>
  );
}
