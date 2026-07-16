"use client";

import { useState, useEffect } from "react";
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
  Eye,
  EyeOff,
} from "lucide-react";

interface SAPConnectionCardProps {
  connection: SAPConnection | null;
  selectedCompanyId?: number | null;
  companyName?: string;
  onSaved: () => void;
}

export function SAPConnectionCard({
  connection,
  selectedCompanyId,
  companyName,
  onSaved,
}: SAPConnectionCardProps) {
  const [name, setName] = useState(connection?.name || "Primary SAP Connection");
  const [baseUrl, setBaseUrl] = useState(connection?.base_url || "");
  const [companyDb, setCompanyDb] = useState(connection?.company_db || "");
  const [username, setUsername] = useState(connection?.username || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifySsl, setVerifySsl] = useState(connection?.verify_ssl ?? true);

  useEffect(() => {
    setName(connection?.name || "Primary SAP Connection");
    setBaseUrl(connection?.base_url || "");
    setCompanyDb(connection?.company_db || "");
    setUsername(connection?.username || "");
    setPassword("");
    setVerifySsl(connection?.verify_ssl ?? true);
    setTestResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [connection]);

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
      const url = `/settings/test-sap${selectedCompanyId ? `?company_id=${selectedCompanyId}` : ""}`;
      const res = await fetchWithAuth(url, {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || "Failed to initiate SAP diagnostic test.");
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
      const payload: Record<string, unknown> = {
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

      const url = `/settings/sap-connection${selectedCompanyId ? `?company_id=${selectedCompanyId}` : ""}`;
      const res = await fetchWithAuth(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const errData = await res.json();
        throw new Error(errData.detail || "Optimistic lock error: Remote settings have been updated by another user. Reload required.");
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save SAP connection parameters.");
      }

      setPassword("");
      setSuccessMessage("SAP connection configuration saved successfully!");
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <Server className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              SAP Business One Connection
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Service Layer parameters & credentials{companyName ? ` for ${companyName}` : ""}
            </p>
          </div>
        </div>

        {connection ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Unconfigured
          </span>
        )}
      </div>

      <form onSubmit={handleSaveConnection} className="p-6 space-y-6">
        {!connection && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2.5 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              No SAP connection currently exists for {companyName || "this company"}. Enter parameters below to establish integration.
            </div>
          </div>
        )}

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

        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Connection Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Service Layer"
              required
              className="w-full px-3.5 py-2.5 h-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-500" />
              Service Layer Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://b1su0206.cloudtaktiks.com:50000/b1s/v1"
              required
              className="w-full px-3.5 py-2.5 h-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              Company Database Name
            </label>
            <input
              type="text"
              value={companyDb}
              onChange={(e) => setCompanyDb(e.target.value)}
              placeholder="CT_TECHBIZ_TESTII"
              required
              className="w-full px-3.5 py-2.5 h-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" />
              Service Layer Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cloudtaktiks\username"
              required
              className="w-full px-3.5 py-2.5 h-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-500" />
                Password
              </span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={connection?.password_set ? "•••••••• (Unchanged)" : "Enter Service Layer Password"}
                className="w-full pl-3.5 pr-10 py-2.5 h-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
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
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-all duration-150 border border-slate-200 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            ) : (
              <Activity className="w-4 h-4 text-slate-500" />
            )}
            Run Diagnostics
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Configuration
          </button>
        </div>
      </form>

      {/* Diagnostics Modal / Output Display */}
      {testResult && (
        <div className="m-6 p-5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm space-y-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              {testResult.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className="font-bold text-slate-900">
                {testResult.connected ? "Diagnostic Test Succeeded" : "Connection Failure Diagnostic"}
              </span>
            </div>

            {testResult.metadata?.latency_ms && (
              <span className="text-xs text-slate-600 flex items-center gap-1.5 font-mono bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {testResult.metadata.latency_ms} ms
              </span>
            )}
          </div>

          <div className="space-y-2">
            {Object.entries(testResult.steps).map(([stepKey, stepVal]) => (
              <div
                key={stepKey}
                className="flex items-start gap-2.5 text-xs font-mono p-3 rounded-lg bg-white border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
              >
                {stepVal.status === "pass" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold text-slate-700 capitalize">{stepKey.replace(/_/g, " ")}: </span>
                  <span className="text-slate-600">{stepVal.message}</span>
                </div>
              </div>
            ))}
          </div>

          {testResult.metadata && (
            <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-3 border-t border-slate-200">
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">System Version</span>
                <span className="text-slate-800 font-bold">{testResult.metadata.system_version}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase tracking-wider">Connected Company</span>
                <span className="text-slate-800 font-bold">{testResult.metadata.company_name}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
