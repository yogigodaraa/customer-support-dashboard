"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";
import Sidebar from "./Sidebar";
import AppShell from "./AppShell";

export default function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Full-screen loader while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Public pages: no auth, no sidebar
  if (pathname === "/login" || pathname.startsWith("/csat")) return <>{children}</>;

  // Not authenticated: AuthContext will redirect
  if (!user) return null;

  // Full app shell
  return (
    <AppShell>
      <Sidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </AppShell>
  );
}
