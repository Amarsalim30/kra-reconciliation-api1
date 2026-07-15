"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import {
  Activity,
  Archive,
  Database,
  FileCode,
  History,
  LayoutDashboard,
  Server,
  ShieldCheck,
  Sliders,
  Tag,
} from "lucide-react";

interface SettingsLayoutProps {
  children: ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Overview",
      href: "/settings",
      icon: LayoutDashboard,
      active: pathname === "/settings",
    },
    {
      label: "SAP Connection",
      href: "/settings/connection",
      icon: Server,
      active: pathname.startsWith("/settings/connection"),
    },
    {
      label: "Reconciliation Rules",
      href: "/settings/reconciliation",
      icon: Sliders,
      active: pathname.startsWith("/settings/reconciliation"),
    },
    {
      label: "Tax Configuration",
      href: "/settings/tax",
      icon: Tag,
      active: pathname.startsWith("/settings/tax"),
    },
    {
      label: "Field Mapping",
      href: "/settings/field-mapping",
      icon: FileCode,
      active: pathname.startsWith("/settings/field-mapping"),
    },
    {
      label: "System Doctor",
      href: "/settings/diagnostics",
      icon: Activity,
      active: pathname.startsWith("/settings/diagnostics"),
    },
    {
      label: "Audit Log History",
      href: "/settings/audit",
      icon: History,
      active: pathname.startsWith("/settings/audit"),
    },
    {
      label: "Backup & Restore",
      href: "/settings/backup",
      icon: Archive,
      active: pathname.startsWith("/settings/backup"),
    },
  ];

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Enterprise Settings & Configuration
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Redesigned configuration manager: SAP connections, matching parameters, tax master data, and health diagnostics.
          </p>
        </div>
      </div>

      {/* Main Grid Layout: Left Nav Sidebar + Right Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left Navigation Panel */}
        <aside className="md:col-span-1 bg-white border border-slate-200 rounded-xl p-2 shadow-xs space-y-1 sticky top-6">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Configuration Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${item.active ? "text-white" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </aside>

        {/* Right Content View */}
        <main className="md:col-span-3 space-y-6">{children}</main>
      </div>
    </div>
  );
}
