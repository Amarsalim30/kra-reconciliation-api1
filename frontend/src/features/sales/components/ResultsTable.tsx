"use client";

import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { Invoice, ReconciliationResult, ReconciliationSummary } from "../types";

const formatVatGroup = (vat?: string) => {
  if (!vat) return "";
  const value = vat.trim();
  return /^\d+(\.\d+)?$/.test(value) ? `${value}%` : value;
};

interface ResultsTableProps {
  results: ReconciliationResult[];
  summary: ReconciliationSummary | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

function CompareCell({
  sapVal,
  kraVal,
  isMatch,
  isMissingSap,
  isMissingKra,
  formatNumeric = false,
}: {
  sapVal?: string | number;
  kraVal?: string | number;
  isMatch: boolean;
  isMissingSap: boolean;
  isMissingKra: boolean;
  formatNumeric?: boolean;
}) {
  const format = (val: string | number | undefined | null) => {
    if (val === null || val === undefined) return "-";
    if (formatNumeric && typeof val === "number") {
      return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(val);
  };

  const s = format(sapVal);
  const k = format(kraVal);

  if (isMatch) {
    return <span className="text-green-600">{s}</span>;
  }

  if (isMissingSap) {
    return <span className="text-red-600">{k}</span>;
  }

  if (isMissingKra) {
    return <span className="text-red-600">{s}</span>;
  }

  return (
    <div className="flex flex-col text-xs leading-tight">
      <span className="text-slate-500">SAP: {s}</span>
      <span className="text-red-600">KRA: {k}</span>
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

  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [onLoadMore, hasMore, isLoadingMore]);

  if (!results || results.length === 0) return null;

  return (
    <div className="flex flex-col mt-4">
      {summary && (
        <div className="mb-4 text-sm font-medium text-slate-700 flex justify-between items-center">
          <div>
            SAP: {summary.total_sap} | KRA: {summary.total_kra} | Matched: {summary.matches} | Issues: {summary.total_sap + summary.total_kra - 2 * summary.matches}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {results.length} results
          </span>
        </div>
      )}
      
      <div className="flex flex-col border border-slate-200 bg-white shadow-sm overflow-hidden h-[750px]">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap relative">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
              <tr>
                <th className="px-4 py-3 font-medium w-10 text-center bg-slate-50"></th>
                <th className="px-4 py-3 font-medium bg-slate-50">Invoice No</th>
                <th className="px-4 py-3 font-medium bg-slate-50">Partner Name</th>
                <th className="px-4 py-3 font-medium bg-slate-50">Invoice Date</th>
                <th className="px-4 py-3 font-medium bg-slate-50">CU Number</th>
                <th className="px-4 py-3 font-medium text-right bg-slate-50">Base Amount</th>
                <th className="px-4 py-3 font-medium text-right bg-slate-50">VAT Group</th>
                <th className="px-4 py-3 font-medium bg-slate-50">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r, idx) => {
                const isMatch = r.status === "Match" || r.status === "Matched";
                const isMissingSap = r.status === "Missing in SAP";
                const isMissingKra = r.status === "Missing in KRA";
                
                const sap = r.sap || {} as Partial<Invoice>;
                const kra = r.kra || {} as Partial<Invoice>;

                let remark = r.status;
                if (r.status === "AMOUNT_MISMATCH") remark = "Amount mismatch";
                if (r.status === "VAT_MISMATCH") remark = "VAT mismatch";
                if (r.status === "MISSING_IN_SAP") remark = "Missing in SAP";
                if (r.status === "MISSING_IN_KRA") remark = "Missing in KRA";
                if (r.status === "MULTIPLE_MISMATCHES") remark = "Multiple mismatches";
                if (r.status === "DUPLICATE_SOURCE_KEY") remark = "Duplicate MatchKey detected (CU Number + VAT Group)";
                if (r.status === "MATCH") remark = "Matched";

                return (
                  <tr key={`${r.cu_number}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 text-center align-middle">
                      {isMatch ? (
                        <Check className="w-4 h-4 text-green-600 inline-block" strokeWidth={3} />
                      ) : (
                        <X className="w-4 h-4 text-red-600 inline-block" strokeWidth={3} />
                      )}
                    </td>
                    
                    <td className="px-4 py-2 font-mono align-middle">
                      <CompareCell
                        sapVal={sap.invoice_number}
                        kraVal={kra.invoice_number}
                        isMatch={sap.invoice_number === kra.invoice_number || isMatch}
                        isMissingSap={isMissingSap}
                        isMissingKra={isMissingKra}
                      />
                    </td>
                    
                    <td className="px-4 py-2 truncate max-w-[150px] align-middle">
                      <CompareCell
                        sapVal={sap.partner_name}
                        kraVal={kra.partner_name}
                        isMatch={sap.partner_name === kra.partner_name || isMatch}
                        isMissingSap={isMissingSap}
                        isMissingKra={isMissingKra}
                      />
                    </td>
                    
                    <td className="px-4 py-2 align-middle">
                      <CompareCell
                        sapVal={sap.invoice_date}
                        kraVal={kra.invoice_date}
                        isMatch={r.date_match || isMatch}
                        isMissingSap={isMissingSap}
                        isMissingKra={isMissingKra}
                      />
                    </td>
                    
                    <td className="px-4 py-2 font-mono text-slate-700 align-middle">
                      {r.cu_number}
                    </td>
                    
                    <td className="px-4 py-2 text-right font-mono align-middle">
                      <CompareCell
                        sapVal={sap.base_amount}
                        kraVal={kra.base_amount}
                        isMatch={r.amount_match || isMatch}
                        isMissingSap={isMissingSap}
                        isMissingKra={isMissingKra}
                        formatNumeric={true}
                      />
                    </td>
                    
                    <td className="px-4 py-2 text-right align-middle">
                      <CompareCell
                        sapVal={formatVatGroup(sap.vat_group)}
                        kraVal={formatVatGroup(kra.vat_group)}
                        isMatch={r.vat_match || isMatch}
                        isMissingSap={isMissingSap}
                        isMissingKra={isMissingKra}
                      />
                    </td>
                    
                    <td className="px-4 py-2 text-slate-600 font-medium align-middle">
                      {remark}
                    </td>
                  </tr>
                );
              })}

              {/* Skeleton Loader Rows */}
              {isLoadingMore && (
                <>
                  {[...Array(3)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-4 mx-auto"></div></td>
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
