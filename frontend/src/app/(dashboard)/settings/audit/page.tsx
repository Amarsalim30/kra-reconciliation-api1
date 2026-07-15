"use client";

import { SettingsLayout } from "@/features/settings/SettingsLayout";
import { AuditLogDrawer } from "@/features/settings/AuditLogDrawer";

export default function AuditHistoryPage() {
  return (
    <SettingsLayout>
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Audit Change History Logs</h2>
        <p className="text-xs text-slate-500">
          Complete, fine-grained change log of all operational setting and tax mapping modifications.
        </p>
        <AuditLogDrawer />
      </div>
    </SettingsLayout>
  );
}
