"use client";

import { SalesInvoice } from "@/types";

interface InvoiceTableProps {
  title: string;
  data: SalesInvoice[];
}

export function InvoiceTable({ title, data }: InvoiceTableProps) {
  return (
    <div className="flex flex-col border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice No</th>
              <th className="px-4 py-3 font-medium">Customer No</th>
              <th className="px-4 py-3 font-medium">Invoice Date</th>
              <th className="px-4 py-3 font-medium">CU Number</th>
              <th className="px-4 py-3 font-medium text-right">Base Amount</th>
              <th className="px-4 py-3 font-medium text-right">VAT Group</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No records available
                </td>
              </tr>
            ) : (
              data.map((inv, idx) => (
                <tr key={`${inv.invoice_number}-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-slate-700">{inv.invoice_number}</td>
                  <td className="px-4 py-2 text-slate-700 truncate max-w-[200px]" title={inv.customer_name}>
                    {inv.customer_name}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{inv.invoice_date}</td>
                  <td className="px-4 py-2 font-mono text-slate-700">{inv.cu_number}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-700">
                    {inv.base_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">{inv.vat_group}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
