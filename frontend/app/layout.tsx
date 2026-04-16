import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import CommandPalette from "@/components/CommandPalette";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";
import { AiChatProvider } from "@/components/AiChatContext";
import { AuthProvider } from "@/components/AuthContext";
import { WebSocketProvider } from "@/components/WebSocketContext";
import AuthenticatedShell from "@/components/AuthenticatedShell";

export const metadata: Metadata = {
  title: "WeSupport - Unified Support Dashboard",
  description: "Unified support platform integrating Luciq, Intercom, Gmail, and Retool",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900">
        <AuthProvider>
          <WebSocketProvider>
            <ToastProvider>
              <AiChatProvider>
                <AuthenticatedShell>
                  {children}
                </AuthenticatedShell>
                <CommandPalette />
                <KeyboardShortcutsModal />
              </AiChatProvider>
            </ToastProvider>
          </WebSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
