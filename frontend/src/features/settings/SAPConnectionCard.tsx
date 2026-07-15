"use client";

import { useState } from "react";
import { SAPConnection, TestConnectionResponse } from "@/types/settings";
import { fetchWithAuth } from "@/lib/api";
import {
  Server,
  Key,
  Database,
  User,
  ShieldCheck,
  ShieldAlert,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Save,
} from "lucide-react";

interface SAPConnectionCardProps {
  connection: SAPConnection | null;
  isEnvFallback: boolean;
  onSaved: () => void;
}

export function SAPConnectionCard({
  connection,
  isEnvFallback,
  onSaved,
}: SAPConnectionCardProps) {
  const [name, setName] = useState(connection?.name || "Primary SAP Connection");
  const [baseUrl, setBaseUrl] = useState(connection?.base_url || "");
  const [companyDb, setCompanyDb] = useState(connection?.company_db || "");
  const [username, setUsername] = useState(connection?.username || "");
  const [password, setPassword] = useState("");
  const [verifySsl, setVerifySsl] = useState(connection?.verify_ssl ?? true);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMessage(null);
    try {
      const res = await fetchWithAuth("/settings/connection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: baseUrl,
          company_db: companyDb,
          username: username,
          password: password || undefined,
          verify_ssl: verifySsl,
        }),
      });
      const data: TestConnectionResponse = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to run SAP connection diagnostics.");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: Record<string, any> = {
        name,
        base_url: baseUrl,
        company_db: companyDb,
        username,
        verify_ssl: verifySsl,
        version: connection?.version || 1,
      };
      if (password) {
        payload.password = password;
      }

      const res = await fetchWithAuth("/settings/connection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const errData = await res.json();
        throw new Error(errData.detail || "Optimistic lock error: Remote settings updated by another administrator.");
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save SAP connection parameters.");
      }

      setPassword("");
      setSuccessMessage("SAP connection configuration saved successfully!");
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              SAP Infrastructure Connection
              {isEnvFallback && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal border border-amber-500/30">
                  Fallback Active (.env)
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Configure Service Layer connection string, database, and credential parameters.
            </p>
          </div>
        </div>

        {connection && (
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Version v{connection.version}</span>
            <span className="text-[11px] text-emerald-400 font-mono font-medium">
              {connection.password_set ? "Credentials Configured" : "Unauthenticated"}
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveConnection} className="p-6 space-y-6">
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>{successMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Connection Identifier Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Service Layer"
              required
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              Service Layer Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://b1su0206.cloudtaktiks.com:50000/b1s/v1"
              required
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-500" />
              Company Database Name
            </label>
            <input
              type="text"
              value={companyDb}
              onChange={(e) => setCompanyDb(e.target.value)}
              placeholder="CT_TECHBIZ_TESTII"
              required
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Service Layer Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cloudtaktiks\username"
              required
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                Password Credential
              </span>
              {connection?.password_set && (
                <span className="text-[11px] text-slate-500 normal-case font-normal">
                  Password configured. Leave empty to maintain existing key.
                </span>
              )}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={connection?.password_set ? "•••••••• (Unchanged)" : "Enter Service Layer Password"}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-2 pt-2 flex items-center justify-between border-t border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verifySsl}
                onChange={(e) => setVerifySsl(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-800 block">Enforce SSL Verification</span>
                <span className="text-xs text-slate-500 block">
                  Disable only for dev/testing servers using self-signed TLS certificates.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Diagnostic Action Bar */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-slate-300"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <Activity className="w-4 h-4 text-slate-600" />
            )}
            Run Connection Diagnostics
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Connection Parameters
          </button>
        </div>
      </form>

      {/* Diagnostics Modal / Output Display */}
      {testResult && (
        <div className="m-6 p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 text-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              {testResult.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400" />
              )}
              <span className="font-semibold text-white">
                {testResult.connected ? "Diagnostic Test Succeeded" : "Connection Failure Diagnostic"}
              </span>
            </div>

            {testResult.metadata?.latency_ms && (
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {testResult.metadata.latency_ms} ms
              </span>
            )}
          </div>

          <div className="space-y-2">
            {Object.entries(testResult.steps).map(([stepKey, stepVal]) => (
              <div
                key={stepKey}
                className="flex items-start gap-2 text-xs font-mono p-2 rounded bg-slate-950/60 border border-slate-800"
              >
                {stepVal.status === "pass" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold text-slate-300 capitalize">{stepKey.replace("_", " ")}: </span>
                  <span className="text-slate-400">{stepVal.message}</span>
                </div>
              </div>
            ))}
          </div>

          {testResult.metadata && (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-500 block">System Version</span>
                <span className="text-slate-300 font-semibold">{testResult.metadata.system_version}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Connected Company</span>
                <span className="text-slate-300 font-semibold">{testResult.metadata.company_name}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
