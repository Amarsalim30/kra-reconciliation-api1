"use client";

import { Check, X } from "lucide-react";
import { SalesInvoice, ReconciliationResult, ReconciliationSummary } from "@/types";

interface ResultsTableProps {
  results: ReconciliationResult[];
  summary: ReconciliationSummary | null;
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

export function ResultsTable({ results, summary }: ResultsTableProps) {
  if (!results || results.length === 0) return null;

  return (
    <div className="flex flex-col mt-8">
      {summary && (
        <div className="mb-4 text-sm font-medium text-slate-700">
          SAP: {summary.total_sap} | KRA: {summary.total_kra} | Matched: {summary.matches} | Issues: {results.length - summary.matches}
        </div>
      )}
      
      <div className="flex flex-col border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium w-10 text-center"></th>
                <th className="px-4 py-3 font-medium">Invoice No</th>
                <th className="px-4 py-3 font-medium">Customer No</th>
                <th className="px-4 py-3 font-medium">Invoice Date</th>
                <th className="px-4 py-3 font-medium">CU Number</th>
                <th className="px-4 py-3 font-medium text-right">Base Amount</th>
                <th className="px-4 py-3 font-medium text-right">VAT Group</th>
                <th className="px-4 py-3 font-medium">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r, idx) => {
                const isMatch = r.status === "Match" || r.status === "Matched";
                const isMissingSap = r.status === "Missing in SAP";
                const isMissingKra = r.status === "Missing in KRA";
                
                const sap = r.sap || {} as Partial<SalesInvoice>;
                const kra = r.kra || {} as Partial<SalesInvoice>;

                let remark = r.status;
                if (r.status === "AMOUNT_MISMATCH") remark = "Amount mismatch";
                if (r.status === "VAT_MISMATCH") remark = "VAT mismatch";
                if (r.status === "DATE_MISMATCH") remark = "Date mismatch";
                if (r.status === "MISSING_IN_SAP") remark = "Missing in SAP";
                if (r.status === "MISSING_IN_KRA") remark = "Missing in KRA";
                if (r.status === "MULTIPLE_MISMATCHES") remark = "Multiple mismatches";
                if (r.status === "DUPLICATE_CU") remark = "Duplicate CU";
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
                        sapVal={sap.customer_name}
                        kraVal={kra.customer_name}
                        isMatch={sap.customer_name === kra.customer_name || isMatch}
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
                        sapVal={sap.vat_group}
                        kraVal={kra.vat_group}
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
