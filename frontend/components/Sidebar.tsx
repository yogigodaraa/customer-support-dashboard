"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebSocketContext";

const NAV = [
  { href: "/",          label: "Dashboard", icon: "📊" },
  { href: "/gmail",     label: "Support",   icon: "📧" },
  { href: "/kyc",       label: "KYC",       icon: "🔐" },
  { href: "/intercom",  label: "Intercom",  icon: "💬" },
  { href: "/luciq",     label: "Luciq",     icon: "🐛" },
  { href: "/templates", label: "Templates", icon: "📝" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();

  return (
    <aside className="w-56 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-screen">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-center">
        <Image
          src="/wsupport-logo.png"
          alt="WSupport"
          width={160}
          height={60}
          className="object-contain"
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className="text-base">{icon}</span>
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}

        {/* Divider */}
        <div className="pt-3 pb-1">
          <div className="border-t border-gray-100 dark:border-gray-700" />
        </div>

        {/* Settings — all roles */}
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/settings"
              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <span className="text-base">⚙️</span>
          <span className="flex-1">Settings</span>
        </Link>

        {/* Admin — admin only */}
        {user?.role === "admin" && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <span className="text-base">🛡️</span>
            <span className="flex-1">Admin</span>
          </Link>
        )}
      </nav>

      {/* AI + Search shortcut buttons */}
      <div className="px-3 pb-3 space-y-1.5">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", metaKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition text-left group"
        >
          <span className="text-gray-400 text-sm group-hover:text-emerald-600">✨</span>
          <span className="text-xs text-gray-400 group-hover:text-emerald-600 flex-1">AI Assistant</span>
          <span className="flex items-center gap-0.5">
            <kbd className="text-xs text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1">⌘</kbd>
            <kbd className="text-xs text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1">J</kbd>
          </span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left group"
        >
          <span className="text-gray-400 text-sm group-hover:text-gray-600">🔍</span>
          <span className="text-xs text-gray-400 group-hover:text-gray-600 flex-1">Search</span>
          <span className="flex items-center gap-0.5">
            <kbd className="text-xs text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1">⌘</kbd>
            <kbd className="text-xs text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1">K</kbd>
          </span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", metaKey: true, bubbles: true }))}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition text-left group"
        >
          <span className="text-gray-400 text-sm group-hover:text-violet-600">⌨️</span>
          <span className="text-xs text-gray-400 group-hover:text-violet-600 flex-1">Shortcuts</span>
          <span className="flex items-center gap-0.5">
            <kbd className="text-xs text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1">⌘</kbd>
            <kbd className="text-xs text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1">?</kbd>
          </span>
        </button>
      </div>

      {/* User badge + logout */}
      <div className="px-3 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name || user?.email}</p>
            <p className="text-xs text-gray-400 capitalize flex items-center gap-1.5">
              {user?.role}
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-gray-300"}`} title={isConnected ? "Connected" : "Disconnected"} />
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="text-gray-400 hover:text-red-500 transition p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
