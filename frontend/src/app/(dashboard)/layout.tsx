"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    } else {
      setTimeout(() => setAuthorized(true), 0);
    }
  }, [router]);

  if (!authorized) {
    // Avoid flash of content before client-side redirect
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 w-full px-8 py-8 flex flex-col gap-8">
        {children}
      </main>
    </div>
  );
}
