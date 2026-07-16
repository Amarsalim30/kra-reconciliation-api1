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

type ActiveTab =
  | "company-profile"
  | "users"
  | "sap-connection"
  | "sap-vat-mappings"
  | "recon-rules"
  | "kra-vat-mappings";

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsComposite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("sap-connection");

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to retrieve configuration settings.");
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
    const timer = setTimeout(() => {
      loadSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSettings]);

  // Load company/users data when tab becomes active or after admin actions
  useEffect(() => {
    if (activeTab === "company-profile" || activeTab === "users") {
      const timer = setTimeout(() => {
        loadCompanyData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, loadCompanyData]);

  const handleCompanySaved = useCallback(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-3 bg-[#F8FAFC]">
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

  const sections: NavSection[] = [
    {
      title: "Organization & Access",
      items: [
        { id: "company-profile", label: "Company Profile", icon: <Building2 className="w-4 h-4" />, adminOnly: true },
        { id: "users", label: "User Management", icon: <Users className="w-4 h-4" />, adminOnly: true },
      ],
    },
    {
      title: "SAP Integration",
      items: [
        { id: "sap-connection", label: "Connection Parameters", icon: <Server className="w-4 h-4" /> },
        { id: "sap-vat-mappings", label: "VAT Tax Codes", icon: <Tag className="w-4 h-4" /> },
      ],
    },
    {
      title: "Reconciliation",
      items: [
        { id: "recon-rules", label: "Rules & Tolerances", icon: <Sliders className="w-4 h-4" /> },
        { id: "kra-vat-mappings", label: "KRA Section VAT Mappings", icon: <Tag className="w-4 h-4" /> },
      ],
    },
  ];

  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => !item.adminOnly || isAdmin),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full space-y-6 pb-12 px-4 md:px-6">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Enterprise Settings
            <ShieldCheck className="w-5.5 h-5.5 text-blue-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage SAP infrastructure endpoints, reconciliation tolerances, KRA mappings, and team access.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Sticky Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-6 space-y-6">
          <nav className="space-y-6 bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {filteredSections.map((section, idx) => (
              <div key={idx} className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                  {section.title}
                </h4>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                            isActive
                              ? "bg-blue-50 text-blue-700 shadow-sm"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        >
                          <span className={isActive ? "text-blue-600" : "text-slate-400"}>
                            {item.icon}
                          </span>
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Right Tab Panel Content */}
        <main className="flex-1 min-w-0 w-full">
          {activeTab === "sap-connection" && (
            <SAPConnectionCard
              connection={data.sap_connection}
              onSaved={loadSettings}
            />
          )}

          {activeTab === "recon-rules" && (
            <SystemSettingsCard
              settings={data.system_settings}
              onSaved={loadSettings}
            />
          )}

          {activeTab === "sap-vat-mappings" && (
            <VATMappingEditor
              connectionId={data.sap_connection?.id || 0}
              mappings={data.vat_mappings}
              onSaved={loadSettings}
            />
          )}

          {activeTab === "kra-vat-mappings" && (
            <KRAVATMappingEditor
              mappings={data.kra_vat_mappings}
              onSaved={loadSettings}
            />
          )}

          {activeTab === "company-profile" && isAdmin && (
            company ? (
              <CompanyProfileCard company={company} onSaved={handleCompanySaved} />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 flex items-center justify-center gap-3 text-slate-400 shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Loading company profile...</span>
              </div>
            )
          )}

          {activeTab === "users" && isAdmin && (
            <UserManagementCard
              users={users}
              currentUserId={currentUserId ?? 0}
              onSaved={handleCompanySaved}
            />
          )}
        </main>
      </div>
    </div>
  );
}

