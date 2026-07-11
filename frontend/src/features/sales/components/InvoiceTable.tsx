"use client";

import { useEffect, useRef } from "react";
import { Invoice } from "../types";

interface InvoiceTableProps {
  title: string;
  data: Invoice[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

const formatVatGroup = (vat?: string) => {
  if (!vat) return "";
  const value = vat.trim();
  return /^\d+(\.\d+)?$/.test(value) ? `${value}%` : value;
};

export function InvoiceTable({ title, data, hasMore = false, isLoadingMore = false, onLoadMore }: InvoiceTableProps) {
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

  return (
    <div className="flex flex-col border border-slate-200 bg-white shadow-sm overflow-hidden mb-6 h-[650px]">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">{title}</h3>
        {data.length > 0 && (
          <span className="text-xs text-slate-500 font-medium">
            Showing {data.length} records
          </span>
        )}
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm text-left whitespace-nowrap relative">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
            <tr>
              <th className="px-4 py-3 font-medium bg-slate-50">Invoice No</th>
              <th className="px-4 py-3 font-medium bg-slate-50">Partner Name</th>
              <th className="px-4 py-3 font-medium bg-slate-50">Invoice Date</th>
              <th className="px-4 py-3 font-medium bg-slate-50">CU Number</th>
              <th className="px-4 py-3 font-medium text-right bg-slate-50">Base Amount</th>
              <th className="px-4 py-3 font-medium text-right bg-slate-50">VAT Group</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 && !isLoadingMore ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No records available
                </td>
              </tr>
            ) : (
              <>
                {data.map((inv, idx) => (
                  <tr key={`${inv.invoice_number}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 font-mono text-slate-700">{inv.invoice_number}</td>
                    <td className="px-4 py-2 text-slate-700 truncate max-w-[200px]" title={inv.partner_name}>
                      {inv.partner_name}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{inv.invoice_date}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{inv.cu_number}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">
                      {inv.base_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{formatVatGroup(inv.vat_group)}</td>
                  </tr>
                ))}
                
                {/* Skeleton Loader Rows */}
                {isLoadingMore && (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <tr key={`skeleton-${i}`} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-16 ml-auto"></div></td>
                        <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-10 ml-auto"></div></td>
                      </tr>
                    ))}
                  </>
                )}
              </>
            )}
          </tbody>
        </table>
        
        {/* Intersection Sentinel element */}
        {hasMore && <div ref={sentinelRef} className="h-4 w-full" />}
      </div>
    </div>
  );
}
