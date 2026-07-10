"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    } else {
      router.push("/sales");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
      </div>
    </div>
  );
}
