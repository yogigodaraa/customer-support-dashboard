"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "agent" | "viewer";
  theme: "light" | "dark";
  signature: string | null;
  image: string | null;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  pendingToken: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void | TwoFactorChallenge>;
  completeTwoFactor: (pendingToken: string, code: string) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  completeTwoFactor: async () => {},
  logout: () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // On mount: read token from localStorage, validate with /api/auth/me
  useEffect(() => {
    const stored = localStorage.getItem("ws_token");
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setToken(stored);
    axios
      .get(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then(res => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem("ws_token");
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Set default Authorization header whenever token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Redirect to /login when not authenticated
  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [isLoading, user, pathname, router]);

  // Apply theme to <html>
  useEffect(() => {
    if (user?.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [user?.theme]);

  const login = useCallback(async (email: string, password: string): Promise<void | TwoFactorChallenge> => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password });
    if (res.data.twoFactorRequired) {
      return res.data as TwoFactorChallenge;
    }
    const { token: jwt, user: u } = res.data;
    localStorage.setItem("ws_token", jwt);
    setToken(jwt);
    setUser(u);
    router.replace("/");
  }, [router]);

  const completeTwoFactor = useCallback(async (pendingToken: string, code: string) => {
    const res = await axios.post(`${API}/api/auth/2fa/verify-login`, { pendingToken, code });
    const { token: jwt, user: u } = res.data;
    localStorage.setItem("ws_token", jwt);
    setToken(jwt);
    setUser(u);
    router.replace("/");
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem("ws_token");
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
    router.replace("/login");
  }, [router]);

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, completeTwoFactor, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
