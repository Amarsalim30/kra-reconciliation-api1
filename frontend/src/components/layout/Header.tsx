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
    <header className="bg-white border-b border-slate-200 px-8 flex justify-between items-center sticky top-0 z-10 h-16">
      <div className="flex items-center gap-10 h-full">
        <h1 className="text-[15px] font-bold text-slate-900 tracking-tight shrink-0 leading-none">
          SAP-KRA Reconciliation Bridge
        </h1>
        <nav className="flex h-full">
          {[
            { href: "/sales", label: "Sales" },
            { href: "/purchases", label: "Purchases" },
            { href: "/settings", label: "Settings" },
          ].map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative h-full flex items-center px-4 text-sm font-medium transition-colors ${
                  active
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-600 rounded-t-full" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        onClick={handleLogout}
        className="text-slate-400 hover:text-slate-700 flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </header>
  );
}
