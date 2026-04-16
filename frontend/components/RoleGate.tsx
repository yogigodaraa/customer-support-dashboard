"use client";

import { useAuth } from "@/components/AuthContext";
import { ReactNode } from "react";

type Role = "admin" | "agent" | "viewer";

interface RoleGateProps {
  allowed: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders children only if the current user's role is in `allowed`. */
export function RoleGate({ allowed, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Returns true if the current user can perform write operations. */
export function useCanWrite(): boolean {
  const { user } = useAuth();
  return !!user && user.role !== "viewer";
}
