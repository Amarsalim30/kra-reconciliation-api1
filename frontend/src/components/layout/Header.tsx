"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { removeToken, getToken, API_BASE_URL } from "@/lib/api";
import { LogOut } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const token = getToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
      } catch {
        // Proceed with local cleanup even if backend call fails
      }
    }
    removeToken();
    router.push("/login");
  };

  const isActive = (route: string) => {
    return pathname.startsWith(route);
  };

  return (
    <header className="bg-white border-b border-slate-200 px-8 flex justify-between items-center shadow-sm sticky top-0 z-10 h-16">
      <div className="flex items-center gap-8 h-full">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight shrink-0">
          SAP-KRA Reconciliation Bridge
        </h1>
        <nav className="flex gap-6 h-full">
          <Link
            href="/sales"
            className={`h-full flex items-center px-1 border-b-2 font-medium text-sm transition-colors ${
              isActive("/sales")
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Sales
          </Link>
          <Link
            href="/purchases"
            className={`h-full flex items-center px-1 border-b-2 font-medium text-sm transition-colors ${
              isActive("/purchases")
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Purchases
          </Link>
          <Link
            href="/settings"
            className={`h-full flex items-center px-1 border-b-2 font-medium text-sm transition-colors gap-1.5 ${
              isActive("/settings")
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Settings
          </Link>
        </nav>
      </div>

      <button 
        onClick={handleLogout}
        className="text-slate-500 hover:text-slate-700 flex items-center gap-2 text-sm font-medium transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </header>
  );
}
