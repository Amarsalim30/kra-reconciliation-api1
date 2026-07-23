import React from "react";
import { AsyncState, AsyncStatus } from "@/features/sales/workspace/types";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  accessor: (item: T) => React.ReactNode;
  className?: string;
  skeletonWidth?: string; // e.g. "w-20", "w-32"
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  asyncState: AsyncState;
  emptyState: React.ReactNode;
  errorState: React.ReactNode;
  className?: string;
}

export function DataTable<T>({ 
  data, 
  columns, 
  asyncState, 
  emptyState, 
  errorState,
  className = "" 
}: DataTableProps<T>) {
  
  return (
    <div className={`flex flex-col relative w-full h-full ${className}`}>
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm text-left whitespace-nowrap relative">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
            <tr>
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 font-medium bg-slate-50 ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {asyncState.status === AsyncStatus.Loading && (
              <>
                {[...Array(5)].map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse transition-opacity duration-200">
                    {columns.map(col => (
                      <td key={`sk-${col.key}`} className={`px-4 py-3 ${col.className || ""}`}>
                        <div className={`h-4 bg-slate-100 rounded ${col.skeletonWidth || "w-full"}`}></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}

            {asyncState.status === AsyncStatus.Loaded && data.length > 0 && (
              <>
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors animate-fade-in">
                    {columns.map(col => (
                      <td key={col.key} className={`px-4 py-2 text-slate-700 ${col.className || ""}`}>
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>

        {/* Full-panel overlays for Idle, Error, or Empty Loaded states */}
        {asyncState.status === AsyncStatus.Idle && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 animate-fade-in mt-10">
            {emptyState}
          </div>
        )}

        {asyncState.status === AsyncStatus.Error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 animate-fade-in mt-10">
            {errorState}
          </div>
        )}

        {asyncState.status === AsyncStatus.Loaded && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 animate-fade-in mt-10">
            <div className="text-center text-slate-500">
              No records found.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
