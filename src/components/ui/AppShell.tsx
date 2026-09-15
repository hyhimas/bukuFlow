"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import Sidebar from "@/components/ui/Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/login";

  useEffect(() => {
  if (isLoginPage) {
    setSidebarOpen(false);
  }
}, [isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      {/* Tombol buka sidebar */}
      <div className="h-16">
  {!sidebarOpen && (
    <div className="flex h-16 items-center border-b border-slate-200 bg-white px-4">
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Buka menu navigasi"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <MenuIcon />
      </button>

      <span className="ml-3 text-xl font-bold text-slate-900">
        BukuFlow
      </span>
    </div>
  )}
</div>

      {/* Sidebar overlay */}
      <Sidebar
        open={sidebarOpen}
        mobile={true}
        onToggle={() => setSidebarOpen((current) => !current)}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Children tetap pada posisi normal */}
      <main className="min-h-screen min-w-0">
        {children}
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}