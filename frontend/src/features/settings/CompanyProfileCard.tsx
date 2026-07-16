"use client";

import { useState } from "react";
import { CompanyProfile, CompanyUpdatePayload } from "@/types/company";
import { fetchWithAuth } from "@/lib/api";
import {
  Building2,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  MapPin,
  DollarSign,
  Calendar,
  Globe,
} from "lucide-react";

interface CompanyProfileCardProps {
  company: CompanyProfile;
  onSaved: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "UTC",
];

const CURRENCIES = ["KES", "USD", "EUR", "GBP", "ZAR", "NGN", "UGX", "TZS", "ETB"];

export function CompanyProfileCard({ company, onSaved }: CompanyProfileCardProps) {
  const [name, setName] = useState(company.name);
  const [kraPin, setKraPin] = useState(company.kra_pin || "");
  const [timezone, setTimezone] = useState(company.timezone);
  const [currency, setCurrency] = useState(company.currency);
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(company.fiscal_year_start_month);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: CompanyUpdatePayload = {
        name,
        kra_pin: kraPin || undefined,
        timezone,
        currency,
        fiscal_year_start_month: fiscalYearStartMonth,
      };
      const res = await fetchWithAuth("/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save company profile.");
      }
      setSuccess("Company profile saved successfully.");
      onSaved();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-violet-900 to-violet-700 text-white flex items-center gap-4">
        {/* Company Avatar */}
        <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-lg shrink-0 backdrop-blur-sm">
          {initials || <Building2 className="w-6 h-6" />}
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{name}</h2>
          <p className="text-xs text-violet-200 mt-0.5">Company Profile &amp; Legal Information</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-5">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>{success}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Company Name */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp Ltd"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
            />
          </div>

          {/* KRA PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              KRA PIN
            </label>
            <input
              type="text"
              value={kraPin}
              onChange={(e) => setKraPin(e.target.value.toUpperCase())}
              placeholder="e.g. P051234567Q"
              maxLength={20}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
            />
            <span className="text-[11px] text-slate-500">Kenya Revenue Authority PIN for the company.</span>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-500" />
              Base Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 font-medium"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Fiscal Year Start */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Fiscal Year Start
            </label>
            <select
              value={fiscalYearStartMonth}
              onChange={(e) => setFiscalYearStartMonth(parseInt(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
            >
              {MONTH_NAMES.map((month, idx) => (
                <option key={idx + 1} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Save */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Company Profile
          </button>
        </div>
      </form>
    </div>
  );
}
