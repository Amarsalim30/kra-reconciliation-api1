"use client";

import { useEffect, useState } from "react";
import { SettingAuditLog } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import { History, User, Clock, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";

export function AuditLogDrawer() {
  const [logs, setLogs] = useState<SettingAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/settings/audit-logs?limit=50");
      if (res.ok) {
        const data: SettingAuditLog[] = await res.json();
        setLogs(data);
      }
    } catch {
      // Gracefully ignore error on drawer loading
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
            <History className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-white">
              Configuration Change Audit Log History
            </h2>
            <p className="text-xs text-slate-400">
              Immutably track who changed settings, what values were modified, and why.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
          title="Refresh audit log history"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No audit logs recorded yet. Changes will appear here automatically.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const formattedDate = new Date(log.created_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              });

              return (
                <div
                  key={log.id}
                  className="border border-slate-200 rounded-lg overflow-hidden transition-colors"
                >
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="p-4 bg-slate-50 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between select-none"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">
                            {log.action.replace(/_/g, " ")}
                          </span>
                          {log.user_email && (
                            <span className="text-xs text-slate-600 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {log.user_email}
                            </span>
                          )}
                        </div>
                        {log.reason && (
                          <p className="text-xs text-slate-600 italic mt-1 font-sans">
                            &quot;{log.reason}&quot;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {formattedDate}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-slate-900 text-slate-200 text-xs font-mono border-t border-slate-800 space-y-2">
                      <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        Diff Snapshot (Old vs. New Values):
                      </div>
                      <pre className="p-3 bg-slate-950 rounded border border-slate-800 overflow-x-auto text-emerald-400 leading-relaxed">
                        {JSON.stringify(log.changes_json, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
