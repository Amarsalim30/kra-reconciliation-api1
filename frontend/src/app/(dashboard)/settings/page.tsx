"use client";

import { useEffect, useState, useCallback } from "react";
import { SettingsComposite } from "@/types/settings";
import { CompanyProfile, UserRecord } from "@/types/company";
import { fetchWithAuth } from "@/lib/api";
import { SAPConnectionCard } from "@/features/settings/SAPConnectionCard";
import { SystemSettingsCard } from "@/features/settings/SystemSettingsCard";
import { VATMappingEditor } from "@/features/settings/VATMappingEditor";
import { KRAVATMappingEditor } from "@/features/settings/KRAVATMappingEditor";
import { CompanyProfileCard } from "@/features/settings/CompanyProfileCard";
import { UserManagementCard } from "@/features/settings/UserManagementCard";
import {
  Server,
  Sliders,
  Tag,
  Loader2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Building2,
  Users,
} from "lucide-react";

type ActiveTab = "sap" | "system" | "vat" | "company";

export default function SettingsPage() {
  const [data, setData] = useState<SettingsComposite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("sap");

  // Company & Users state
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("checker");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, meRes] = await Promise.all([
        fetchWithAuth("/settings"),
        fetchWithAuth("/auth/me"),
      ]);
      if (!settingsRes.ok) throw new Error("Failed to load enterprise settings parameters.");
      const compositeData: SettingsComposite = await settingsRes.json();
      setData(compositeData);

      if (meRes.ok) {
        const me = await meRes.json();
        setCurrentUserId(me.id);
        setCurrentUserRole(me.role);
      }
    } catch (err: any) {
      setError(err.message || "Failed to retrieve configuration settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompanyData = useCallback(async () => {
    try {
      const [companyRes, usersRes] = await Promise.all([
        fetchWithAuth("/company"),
        fetchWithAuth("/users"),
      ]);
      if (companyRes.ok) setCompany(await companyRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch {
      // non-critical — tab will show loading state
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load company/users data when tab becomes active or after admin actions
  useEffect(() => {
    if (activeTab === "company") {
      loadCompanyData();
    }
  }, [activeTab, loadCompanyData]);

  const handleCompanySaved = useCallback(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-slate-600">Loading Enterprise Configuration...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-4 max-w-2xl mx-auto my-8">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <h3 className="font-semibold text-base">Configuration Loading Error</h3>
        </div>
        <p className="text-sm">{error || "Unable to reach settings endpoint."}</p>
        <button
          onClick={loadSettings}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    );
  }

  const isAdmin = currentUserRole === "admin";

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "sap", label: "SAP Connection & Diagnostics", icon: <Server className="w-4 h-4" /> },
    { id: "system", label: "Reconciliation Rules & Tolerances", icon: <Sliders className="w-4 h-4" /> },
    { id: "vat", label: "VAT Settings", icon: <Tag className="w-4 h-4" /> },
    { id: "company", label: "Company & Users", icon: <Building2 className="w-4 h-4" />, adminOnly: true },
  ];

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full space-y-6 pb-12">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Enterprise Settings &amp; Configuration
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage SAP infrastructure endpoints, reconciliation amount tolerances, and canonical VAT tax codes.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {tabs
          .filter((tab) => !tab.adminOnly || isAdmin)
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-t-lg font-semibold text-sm transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-700 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
      </div>

      {/* Tab Panels */}
      <div className="mt-6">
        {activeTab === "sap" && (
          <SAPConnectionCard
            connection={data.sap_connection}
            onSaved={loadSettings}
          />
        )}

        {activeTab === "system" && (
          <SystemSettingsCard
            settings={data.system_settings}
            onSaved={loadSettings}
          />
        )}

        {activeTab === "vat" && (
          <div className="space-y-6">
            <VATMappingEditor
              connectionId={data.sap_connection?.id || 0}
              mappings={data.vat_mappings}
              onSaved={loadSettings}
            />
            <KRAVATMappingEditor
              mappings={data.kra_vat_mappings}
              onSaved={loadSettings}
            />
          </div>
        )}

        {activeTab === "company" && isAdmin && (
          <div className="space-y-6">
            {company ? (
              <CompanyProfileCard company={company} onSaved={handleCompanySaved} />
            ) : (
              <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Loading company profile...</span>
              </div>
            )}
            <UserManagementCard
              users={users}
              currentUserId={currentUserId ?? 0}
              onSaved={handleCompanySaved}
            />
          </div>
        )}
      </div>
    </div>
  );
}
