"use client";

import { FileText, ArrowRightLeft, ShieldCheck } from "lucide-react";

export function PurchasesReconciliationView() {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-white border border-slate-200 rounded-lg shadow-sm max-w-3xl mx-auto my-12">
      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
        <ArrowRightLeft className="w-8 h-8 animate-pulse" />
      </div>
      
      <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-3">
        Purchases Reconciliation Bridge
      </h2>
      
      <p className="text-slate-500 mb-8 max-w-md leading-relaxed text-sm">
        The Purchases reconciliation module is currently under active development. 
        Once complete, it will allow you to import SAP purchase registers and reconcile them with KRA VAT portal records.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
        <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex gap-4">
          <div className="text-slate-400 mt-1 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 text-sm mb-1">Coming Next</h4>
            <p className="text-slate-500 text-xs leading-normal">
              Support for importing KRA Purchases CSV files and custom validation reporting.
            </p>
          </div>
        </div>

        <div className="p-4 border border-slate-100 rounded-lg bg-slate-50 flex gap-4">
          <div className="text-slate-400 mt-1 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 text-sm mb-1">Double Verification</h4>
            <p className="text-slate-500 text-xs leading-normal">
              Reconcile input VAT credits against supplier declarations to avoid double taxation claims.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
