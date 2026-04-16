"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Tab = "users" | "integrations" | "audit" | "workspace" | "teams" | "automations" | "reports" | "webhooks" | "blocked" | "security" | "health";

interface UserRow { id: string; email: string; name: string | null; role: string; createdAt: string }
interface Integration { service: string; configured: boolean; maskedKey: string | null; label: string | null; lastRotated: string | null }
interface AuditEntry { id: string; action: string; resource: string; details: unknown; createdAt: string; user: { email: string; name: string | null } }

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  agent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  viewer: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const SERVICE_ICON: Record<string, string> = {
  intercom: "💬", gmail: "📧", luciq: "🐛", retool: "🔧",
};

// ─── Invite Modal ────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [loading, setLoading] = useState(false);

  async function handleInvite() {
    if (!email || !name || !password) {
      toast("All fields are required", "error");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/register`, { email, name, password, role });
      toast(`Invited ${email} as ${role}`);
      onInvited();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to invite";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Invite Team Member</h3>
        <div className="space-y-3">
          <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white" />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white" />
          <input type="password" placeholder="Temporary password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white" />
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Role</label>
            <div className="flex gap-2">
              {["admin", "agent", "viewer"].map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                    role === r ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                  }`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
          <button onClick={handleInvite} disabled={loading}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5">
            {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Key Modal ────────────────────────────────────────────────────────────────

function KeyModal({ service, onClose, onSaved }: { service: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!key.trim()) return;
    setLoading(true);
    try {
      await axios.put(`${API}/api/admin/integrations/${service}`, { key: key.trim() });
      toast(`${service} key updated`);
      onSaved();
      onClose();
    } catch {
      toast("Failed to update key", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Update {service} API Key</h3>
        <p className="text-xs text-gray-400 mb-4">Paste the new API key below</p>
        <input type="password" placeholder="New API key" value={key} onChange={e => setKey(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono dark:text-white" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
          <button onClick={handleSave} disabled={loading || !key.trim()}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5">
            {loading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Save Key
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");

  // Users state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Integrations state
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [intLoading, setIntLoading] = useState(true);
  const [editingService, setEditingService] = useState<string | null>(null);

  // Audit state
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsAction, setLogsAction] = useState("");

  // Access gate
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/");
    }
  }, [user, router]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/users`);
      setUsers(res.data.users);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  }, []);

  // Fetch integrations
  const fetchIntegrations = useCallback(async () => {
    setIntLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/integrations`);
      setIntegrations(res.data.integrations);
    } catch { /* ignore */ }
    finally { setIntLoading(false); }
  }, []);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params: Record<string, string | number> = { page: logsPage, limit: 30 };
      if (logsAction) params.action = logsAction;
      const res = await axios.get(`${API}/api/admin/audit-logs`, { params });
      setLogs(res.data.logs);
      setLogsTotalPages(res.data.totalPages);
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, [logsPage, logsAction]);

  useEffect(() => { if (tab === "users") fetchUsers(); }, [tab, fetchUsers]);
  useEffect(() => { if (tab === "integrations") fetchIntegrations(); }, [tab, fetchIntegrations]);
  useEffect(() => { if (tab === "audit") fetchLogs(); }, [tab, fetchLogs]);

  async function changeRole(userId: string, role: string) {
    try {
      await axios.patch(`${API}/api/admin/users/${userId}/role`, { role });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
      toast(`Role updated to ${role}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed";
      toast(msg, "error");
    }
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`Remove ${u.email}?`)) return;
    try {
      await axios.delete(`${API}/api/admin/users/${u.id}`);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast(`${u.email} removed`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed";
      toast(msg, "error");
    }
  }

  if (user?.role !== "admin") return null;

  const TABS: Array<{ key: Tab; label: string; icon: string }> = [
    { key: "users", label: "Users", icon: "👥" },
    { key: "integrations", label: "Integrations", icon: "🔗" },
    { key: "audit", label: "Audit Logs", icon: "📋" },
    { key: "workspace", label: "Workspace", icon: "⚙️" },
    { key: "teams", label: "Teams", icon: "🏢" },
    { key: "automations", label: "Automations", icon: "⚡" },
    { key: "reports", label: "Reports", icon: "📊" },
    { key: "webhooks", label: "Webhooks", icon: "🔗" },
    { key: "blocked", label: "Blocked", icon: "🚫" },
    { key: "health", label: "Health", icon: "💚" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center text-lg text-white font-bold">A</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Admin</h1>
            <p className="text-sm text-gray-400">Manage users, integrations, and view audit logs</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              <span className="mr-1.5">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-6">

        {/* ─── Users Tab ──────────────────────────────────────────── */}
        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">{users.length} team member{users.length !== 1 ? "s" : ""}</p>
              <button onClick={() => setInviteOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5">
                <span className="text-sm leading-none">+</span>Invite
              </button>
            </div>

            {usersLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Email</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Role</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Joined</th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.name || "—"}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={e => changeRole(u.id, e.target.value)}
                            disabled={u.id === user?.id}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer ${ROLE_BADGE[u.role] || ROLE_BADGE.viewer} ${u.id === user?.id ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <option value="admin">admin</option>
                            <option value="agent">agent</option>
                            <option value="viewer">viewer</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString("en-AU")}</td>
                        <td className="px-4 py-3">
                          {u.id !== user?.id && (
                            <button onClick={() => deleteUser(u)} className="text-xs text-red-500 hover:text-red-700 transition">Remove</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={fetchUsers} />}
          </div>
        )}

        {/* ─── Integrations Tab ───────────────────────────────────── */}
        {tab === "integrations" && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Manage API keys for connected services</p>

            {intLoading ? (
              <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-32 bg-white dark:bg-gray-800 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {integrations.map(int => (
                  <div key={int.service} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{SERVICE_ICON[int.service] || "🔧"}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{int.service}</p>
                          <p className={`text-xs mt-0.5 ${int.configured ? "text-green-600" : "text-gray-400"}`}>
                            {int.configured ? "Configured" : "Not configured"}
                          </p>
                        </div>
                      </div>
                    </div>
                    {int.maskedKey && (
                      <p className="text-xs font-mono text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded mb-2">{int.maskedKey}</p>
                    )}
                    {int.lastRotated && (
                      <p className="text-xs text-gray-400 mb-3">Last rotated: {new Date(int.lastRotated).toLocaleDateString("en-AU")}</p>
                    )}
                    <button onClick={() => setEditingService(int.service)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium transition">
                      {int.configured ? "Rotate Key" : "Add Key"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {editingService && <KeyModal service={editingService} onClose={() => setEditingService(null)} onSaved={fetchIntegrations} />}
          </div>
        )}

        {/* ─── Audit Logs Tab ─────────────────────────────────────── */}
        {tab === "audit" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Activity log</p>
              <select
                value={logsAction}
                onChange={e => { setLogsAction(e.target.value); setLogsPage(1); }}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
              >
                <option value="">All actions</option>
                <option value="login">Login</option>
                <option value="invite_user">Invite User</option>
                <option value="change_role">Change Role</option>
                <option value="delete_user">Delete User</option>
                <option value="update_settings">Update Settings</option>
                <option value="change_password">Change Password</option>
                <option value="rotate_integration_key">Rotate Key</option>
              </select>
            </div>

            {logsLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-white dark:bg-gray-800 rounded-lg animate-pulse" />)}</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">No audit logs found</div>
            ) : (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                        <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Time</th>
                        <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">User</th>
                        <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Action</th>
                        <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Resource</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{log.user?.name || log.user?.email || "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md font-mono">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{log.resource}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage === 1}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                      Previous
                    </button>
                    <span className="text-xs text-gray-400">Page {logsPage} of {logsTotalPages}</span>
                    <button onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))} disabled={logsPage === logsTotalPages}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── Workspace Tab ──────────────────────────────────────── */}
        {tab === "workspace" && <WorkspaceTab />}

        {/* ─── Teams Tab ──────────────────────────────────────────── */}
        {tab === "teams" && <TeamsTab users={users} fetchUsers={fetchUsers} />}

        {/* ─── Automations Tab ────────────────────────────────────── */}
        {tab === "automations" && <AutomationsTab />}

        {/* ─── Reports Tab ────────────────────────────────────────── */}
        {tab === "reports" && <ReportsTab />}

        {/* ─── Webhooks Tab ───────────────────────────────────────── */}
        {tab === "webhooks" && <WebhooksTab />}

        {/* ─── Blocked Tab ────────────────────────────────────────── */}
        {tab === "blocked" && <BlockedTab />}

        {/* ─── Health Tab ─────────────────────────────────────────── */}
        {tab === "health" && <HealthTab />}

      </div>
    </div>
  );
}

// ─── Workspace Tab ────────────────────────────────────────────────────────────
function WorkspaceTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/admin/workspace`).then(r => setSettings(r.data)).catch(() => {});
  }, []);

  function set(key: string, value: string) { setSettings(prev => ({ ...prev, [key]: value })); }

  async function save() {
    setSaving(true);
    try {
      await axios.patch(`${API}/api/admin/workspace`, settings);
      toast("Workspace settings saved");
    } catch { toast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  const input = "w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white";

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Branding</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Brand Name</label>
            <input className={input} value={settings.brand_name || ""} onChange={e => set("brand_name", e.target.value)} placeholder="WeSupport" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Support Email</label>
            <input className={input} type="email" value={settings.support_email || ""} onChange={e => set("support_email", e.target.value)} placeholder="support@company.com" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Brand Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={settings.brand_color || "#6366F1"} onChange={e => set("brand_color", e.target.value)} className="w-10 h-9 rounded border border-gray-200 cursor-pointer" />
              <input className={`${input} flex-1`} value={settings.brand_color || ""} onChange={e => set("brand_color", e.target.value)} placeholder="#6366F1" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Business Hours</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
            <input className={input} type="time" value={settings.business_hours_start || "09:00"} onChange={e => set("business_hours_start", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End Time</label>
            <input className={input} type="time" value={settings.business_hours_end || "17:00"} onChange={e => set("business_hours_end", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Timezone</label>
          <select className={input} value={settings.business_hours_timezone || "Australia/Sydney"} onChange={e => set("business_hours_timezone", e.target.value)}>
            {["Australia/Sydney","Australia/Melbourne","Australia/Brisbane","Australia/Perth","America/New_York","America/Los_Angeles","Europe/London","Asia/Tokyo"].map(tz => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
        {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        Save Settings
      </button>
    </div>
  );
}

// ─── Teams Tab ────────────────────────────────────────────────────────────────
interface Team { id: string; name: string; color: string; description: string | null; members: Array<{ userId: string; role: string; user: { name: string | null; email: string } }> }

function TeamsTab({ users, fetchUsers }: { users: UserRow[]; fetchUsers: () => void }) {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366F1");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState("");

  const load = async () => {
    try {
      const r = await axios.get(`${API}/api/admin/teams`);
      setTeams(r.data.teams || r.data);
      fetchUsers();
    } catch { /* silent */ }
  };
  useEffect(() => { load(); }, []);

  async function createTeam() {
    if (!newName.trim()) return;
    try {
      await axios.post(`${API}/api/admin/teams`, { name: newName.trim(), color: newColor });
      toast("Team created");
      setNewName(""); setCreating(false);
      load();
    } catch { toast("Failed to create team", "error"); }
  }

  async function deleteTeam(id: string, name: string) {
    if (!confirm(`Delete team "${name}"?`)) return;
    try {
      await axios.delete(`${API}/api/admin/teams/${id}`);
      toast("Team deleted");
      load();
    } catch { toast("Failed to delete", "error"); }
  }

  async function addMember(teamId: string) {
    if (!addUserId) return;
    try {
      await axios.post(`${API}/api/admin/teams/${teamId}/members`, { userId: addUserId, role: "member" });
      toast("Member added");
      setAddingMember(null); setAddUserId("");
      load();
    } catch { toast("Failed to add member", "error"); }
  }

  async function removeMember(teamId: string, userId: string) {
    try {
      await axios.delete(`${API}/api/admin/teams/${teamId}/members/${userId}`);
      toast("Member removed");
      load();
    } catch { toast("Failed", "error"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{teams.length} team{teams.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setCreating(true)} className="px-3.5 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">+ New Team</button>
      </div>

      {creating && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-3">
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-9 h-9 rounded border cursor-pointer" />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Team name"
            className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:text-white" />
          <button onClick={createTeam} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Create</button>
          <button onClick={() => setCreating(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {teams.map(team => (
        <div key={team.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="flex items-center gap-3 p-4">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: team.color }} />
            <span className="font-medium text-sm text-gray-900 dark:text-white flex-1">{team.name}</span>
            <span className="text-xs text-gray-400">{team.members.length} member{team.members.length !== 1 ? "s" : ""}</span>
            <button onClick={() => setExpanded(expanded === team.id ? null : team.id)} className="text-xs text-indigo-600 hover:underline ml-2">{expanded === team.id ? "Collapse" : "Manage"}</button>
            <button onClick={() => deleteTeam(team.id, team.name)} className="text-xs text-red-400 hover:text-red-600 ml-1">Delete</button>
          </div>

          {expanded === team.id && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3 space-y-2">
              {team.members.map(m => (
                <div key={m.userId} className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-medium text-indigo-700 dark:text-indigo-400 flex-shrink-0">
                    {(m.user.name || m.user.email)[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-gray-700 dark:text-gray-300">{m.user.name || m.user.email}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{m.role}</span>
                  <button onClick={() => removeMember(team.id, m.userId)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              ))}
              {addingMember === team.id ? (
                <div className="flex items-center gap-2 pt-1">
                  <select value={addUserId} onChange={e => setAddUserId(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white">
                    <option value="">Select user...</option>
                    {users.filter(u => !team.members.some(m => m.userId === u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                  <button onClick={() => addMember(team.id)} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Add</button>
                  <button onClick={() => setAddingMember(null)} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingMember(team.id)} className="text-xs text-indigo-600 hover:underline mt-1">+ Add member</button>
              )}
            </div>
          )}
        </div>
      ))}

      {teams.length === 0 && !creating && (
        <div className="text-center py-12 text-sm text-gray-400">No teams yet. Create one to organize your support agents.</div>
      )}
    </div>
  );
}

// ─── Automations Tab ──────────────────────────────────────────────────────────
interface AutoRule { id: string; name: string; trigger: string; actions: unknown[]; isActive: boolean; runCount: number; lastRunAt: string | null; description: string | null }

const TRIGGER_LABELS: Record<string, string> = {
  conversation_opened: "Conversation Opened",
  message_received: "Message Received",
  sla_at_risk: "SLA At Risk",
  kyc_created: "KYC Case Created",
  tag_added: "Tag Added",
  conversation_assigned: "Conversation Assigned",
};

function AutomationsTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AutoRule | null>(null);
  const [form, setForm] = useState({ name: "", trigger: "conversation_opened", description: "" });

  const load = async () => { try { const r = await axios.get(`${API}/api/admin/automations`); setRules(r.data); } catch { /* */ } };
  useEffect(() => { load(); }, []);

  async function toggle(rule: AutoRule) {
    try { await axios.patch(`${API}/api/admin/automations/${rule.id}/toggle`); load(); }
    catch { toast("Failed", "error"); }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    try { await axios.delete(`${API}/api/admin/automations/${id}`); toast("Rule deleted"); load(); }
    catch { toast("Failed", "error"); }
  }

  async function saveRule() {
    try {
      const body = { ...form, actions: [{ type: "notify_agent", params: {} }] };
      if (editing) { await axios.patch(`${API}/api/admin/automations/${editing.id}`, body); toast("Rule updated"); }
      else { await axios.post(`${API}/api/admin/automations`, body); toast("Rule created"); }
      setShowModal(false); setEditing(null); load();
    } catch { toast("Failed to save rule", "error"); }
  }

  const triggerColor: Record<string, string> = {
    conversation_opened: "bg-blue-100 text-blue-700",
    sla_at_risk: "bg-red-100 text-red-700",
    kyc_created: "bg-purple-100 text-purple-700",
    tag_added: "bg-green-100 text-green-700",
    conversation_assigned: "bg-yellow-100 text-yellow-700",
    message_received: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rules.length} rule{rules.length !== 1 ? "s" : ""}</p>
        <button onClick={() => { setEditing(null); setForm({ name: "", trigger: "conversation_opened", description: "" }); setShowModal(true); }}
          className="px-3.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition">+ New Rule</button>
      </div>

      {rules.map(rule => (
        <div key={rule.id} className={`bg-white dark:bg-gray-800 border rounded-xl p-4 flex items-start gap-3 transition ${rule.isActive ? "border-gray-200 dark:border-gray-700" : "border-gray-100 dark:border-gray-700 opacity-60"}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-gray-900 dark:text-white">{rule.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${triggerColor[rule.trigger] || "bg-gray-100 text-gray-700"}`}>
                {TRIGGER_LABELS[rule.trigger] || rule.trigger}
              </span>
            </div>
            {rule.description && <p className="text-xs text-gray-400 mb-1">{rule.description}</p>}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{(rule.actions as unknown[]).length} action{(rule.actions as unknown[]).length !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>Run {rule.runCount}× {rule.lastRunAt ? `· Last: ${new Date(rule.lastRunAt).toLocaleDateString()}` : ""}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => toggle(rule)}
              className={`relative w-10 h-5 rounded-full transition ${rule.isActive ? "bg-amber-500" : "bg-gray-300"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${rule.isActive ? "left-5" : "left-0.5"}`} />
            </button>
            <button onClick={() => { setEditing(rule); setForm({ name: rule.name, trigger: rule.trigger, description: rule.description || "" }); setShowModal(true); }}
              className="text-xs text-indigo-600 hover:underline">Edit</button>
            <button onClick={() => deleteRule(rule.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
          </div>
        </div>
      ))}

      {rules.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">No automation rules yet. Create one to automate repetitive tasks.</div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{editing ? "Edit Rule" : "New Automation Rule"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Rule Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Escalate high-risk KYC"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Trigger</label>
                <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white">
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this rule do?"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
              <button onClick={saveRule} disabled={!form.name.trim()} className="px-4 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {editing ? "Update" : "Create"} Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
interface Report { id: string; name: string; schedule: string; recipients: string[]; isActive: boolean; lastSentAt: string | null; metrics: string[] }

const CRON_PRESETS = [
  { label: "Daily 9am", value: "0 9 * * *" },
  { label: "Mon 9am", value: "0 9 * * 1" },
  { label: "1st of month", value: "0 9 1 * *" },
];

function cronToHuman(expr: string): string {
  const found = CRON_PRESETS.find(p => p.value === expr);
  return found ? found.label : expr;
}

function ReportsTab() {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);
  const [form, setForm] = useState({ name: "", schedule: "0 9 * * 1", recipients: "", metrics: ["summary","slaHealth","kycStats"] });
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => { try { const r = await axios.get(`${API}/api/admin/reports`); setReports(r.data); } catch { /* */ } };
  useEffect(() => { load(); }, []);

  async function sendNow(id: string) {
    setSending(id);
    try { await axios.post(`${API}/api/admin/reports/${id}/send-now`); toast("Report sent!"); load(); }
    catch { toast("Send failed", "error"); }
    finally { setSending(null); }
  }

  async function deleteReport(id: string) {
    if (!confirm("Delete this report?")) return;
    try { await axios.delete(`${API}/api/admin/reports/${id}`); toast("Report deleted"); load(); }
    catch { toast("Failed", "error"); }
  }

  async function saveReport() {
    if (!form.name.trim() || !form.recipients.trim()) { toast("Name and recipients required", "error"); return; }
    const recipients = form.recipients.split(",").map(e => e.trim()).filter(Boolean);
    const body = { name: form.name.trim(), schedule: form.schedule, recipients, metrics: form.metrics };
    try {
      if (editing) { await axios.patch(`${API}/api/admin/reports/${editing.id}`, body); toast("Report updated"); }
      else { await axios.post(`${API}/api/admin/reports`, body); toast("Report created"); }
      setShowModal(false); setEditing(null); load();
    } catch { toast("Failed to save report", "error"); }
  }

  const metricOptions = ["summary","slaHealth","tagBreakdown","kycStats","responseTimes"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{reports.length} scheduled report{reports.length !== 1 ? "s" : ""}</p>
        <button onClick={() => { setEditing(null); setForm({ name: "", schedule: "0 9 * * 1", recipients: "", metrics: ["summary","slaHealth","kycStats"] }); setShowModal(true); }}
          className="px-3.5 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition">+ New Report</button>
      </div>

      {reports.map(report => (
        <div key={report.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-gray-900 dark:text-white">{report.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{cronToHuman(report.schedule)}</span>
            </div>
            <p className="text-xs text-gray-400">→ {report.recipients.join(", ")}</p>
            {report.lastSentAt && (
              <p className="text-xs text-gray-400 mt-0.5">Last sent: {new Date(report.lastSentAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => sendNow(report.id)} disabled={sending === report.id}
              className="px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 flex items-center gap-1">
              {sending === report.id && <span className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />}
              Send Now
            </button>
            <button onClick={() => { setEditing(report); setForm({ name: report.name, schedule: report.schedule, recipients: report.recipients.join(", "), metrics: report.metrics }); setShowModal(true); }}
              className="text-xs text-indigo-600 hover:underline">Edit</button>
            <button onClick={() => deleteReport(report.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
          </div>
        </div>
      ))}

      {reports.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">No scheduled reports yet. Create one to receive regular summaries by email.</div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{editing ? "Edit Report" : "New Scheduled Report"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Report Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Weekly Summary"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Schedule</label>
                <div className="flex gap-2 flex-wrap mb-1">
                  {CRON_PRESETS.map(p => (
                    <button key={p.value} onClick={() => setForm(f => ({ ...f, schedule: p.value }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${form.schedule === p.value ? "bg-green-600 text-white border-green-600" : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-green-500"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <input value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} placeholder="0 9 * * 1"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-mono dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Recipients (comma-separated emails)</label>
                <input value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} placeholder="team@company.com, boss@company.com"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Include Metrics</label>
                <div className="flex flex-wrap gap-2">
                  {metricOptions.map(m => (
                    <button key={m} onClick={() => setForm(f => ({ ...f, metrics: f.metrics.includes(m) ? f.metrics.filter(x => x !== m) : [...f.metrics, m] }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${form.metrics.includes(m) ? "bg-green-100 text-green-700 border-green-300" : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
              <button onClick={saveReport} className="px-4 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
                {editing ? "Update" : "Create"} Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────
interface Webhook { id: string; name: string; url: string; events: string[]; isActive: boolean; lastPingedAt: string | null; lastStatus: string | null }

function WebhooksTab() {
  const { toast } = useToast();
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [form, setForm] = useState({ name: "", url: "", events: ["conversation.created"], secret: "" });
  const [testing, setTesting] = useState<string | null>(null);

  const EVENT_OPTIONS = ["conversation.created","conversation.assigned","conversation.resolved","kyc.case_created","kyc.status_changed","sla.breached"];

  const load = async () => {
    try { const r = await axios.get(`${API}/api/admin/webhooks`); setHooks(r.data); } catch { /* */ }
  };
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name.trim() || !form.url.trim()) { toast("Name and URL required", "error"); return; }
    try {
      const body: Record<string, unknown> = { name: form.name.trim(), url: form.url.trim(), events: form.events };
      if (form.secret) body.secret = form.secret;
      if (editing) { await axios.patch(`${API}/api/admin/webhooks/${editing.id}`, body); toast("Webhook updated"); }
      else { await axios.post(`${API}/api/admin/webhooks`, body); toast("Webhook created"); }
      setShowModal(false); setEditing(null); load();
    } catch { toast("Failed to save", "error"); }
  }

  async function del(id: string) {
    if (!confirm("Delete this webhook?")) return;
    try { await axios.delete(`${API}/api/admin/webhooks/${id}`); toast("Webhook deleted"); load(); }
    catch { toast("Failed", "error"); }
  }

  async function testHook(id: string) {
    setTesting(id);
    try {
      const r = await axios.post(`${API}/api/admin/webhooks/${id}/test`);
      toast(`Ping OK — ${r.data.ms}ms`);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Ping failed";
      toast(msg, "error");
      load();
    } finally { setTesting(null); }
  }

  function toggleEvent(ev: string) {
    setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));
  }

  const statusColor = (s: string | null) => s === "ok" ? "text-green-600" : s === "failed" ? "text-red-500" : "text-gray-400";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{hooks.length} webhook{hooks.length !== 1 ? "s" : ""}</p>
        <button onClick={() => { setEditing(null); setForm({ name: "", url: "", events: ["conversation.created"], secret: "" }); setShowModal(true); }}
          className="px-3.5 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition">+ New Webhook</button>
      </div>

      {hooks.map(wh => (
        <div key={wh.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-medium text-sm text-gray-900 dark:text-white">{wh.name}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wh.isActive ? "bg-green-500" : "bg-gray-300"}`} />
              </div>
              <p className="text-xs text-gray-400 font-mono truncate">{wh.url}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {wh.events.map(e => (
                  <span key={e} className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full">{e}</span>
                ))}
              </div>
              {wh.lastPingedAt && (
                <p className={`text-xs mt-1.5 ${statusColor(wh.lastStatus)}`}>
                  Last ping: {wh.lastStatus} · {new Date(wh.lastPingedAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => testHook(wh.id)} disabled={testing === wh.id}
                className="px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1 text-gray-600 dark:text-gray-300">
                {testing === wh.id && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
                Test
              </button>
              <button onClick={() => { setEditing(wh); setForm({ name: wh.name, url: wh.url, events: wh.events, secret: "" }); setShowModal(true); }}
                className="text-xs text-violet-600 hover:underline">Edit</button>
              <button onClick={() => del(wh.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>
          </div>
        </div>
      ))}

      {hooks.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">No webhooks configured. Add one to receive real-time event notifications.</div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{editing ? "Edit Webhook" : "New Webhook"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Webhook"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">URL</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://hooks.example.com/..."
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white font-mono" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Events</label>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_OPTIONS.map(ev => (
                    <button key={ev} onClick={() => toggleEvent(ev)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${form.events.includes(ev) ? "bg-violet-600 text-white border-violet-600" : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Secret (leave blank to auto-generate)</label>
                <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="Leave blank to auto-generate"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
              <button onClick={save} disabled={!form.name.trim() || !form.url.trim() || form.events.length === 0}
                className="px-4 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {editing ? "Update" : "Create"} Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Blocked Tab ──────────────────────────────────────────────────────────────
interface BlockedContact { id: string; email: string | null; userId: string | null; reason: string | null; blockedBy: string; createdAt: string }

function BlockedTab() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<BlockedContact[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", userId: "", reason: "" });

  const load = async () => {
    try { const r = await axios.get(`${API}/api/admin/blocked`); setContacts(r.data); } catch { /* */ }
  };
  useEffect(() => { load(); }, []);

  async function block() {
    if (!form.email.trim() && !form.userId.trim()) { toast("Email or User ID required", "error"); return; }
    try {
      const body: Record<string, string> = {};
      if (form.email.trim()) body.email = form.email.trim();
      if (form.userId.trim()) body.userId = form.userId.trim();
      if (form.reason.trim()) body.reason = form.reason.trim();
      await axios.post(`${API}/api/admin/blocked`, body);
      toast("Contact blocked");
      setShowModal(false); setForm({ email: "", userId: "", reason: "" }); load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed";
      toast(msg, "error");
    }
  }

  async function unblock(id: string, label: string) {
    if (!confirm(`Unblock ${label}?`)) return;
    try { await axios.delete(`${API}/api/admin/blocked/${id}`); toast("Contact unblocked"); load(); }
    catch { toast("Failed", "error"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{contacts.length} blocked contact{contacts.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowModal(true)}
          className="px-3.5 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition">+ Block Contact</button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No blocked contacts. Block spam emails or user IDs to prevent them from creating tickets.</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-left">Email / User ID</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-left">Reason</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-left">Blocked</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-gray-800 dark:text-gray-200">{c.email || c.userId}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{c.reason || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("en-AU")}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => unblock(c.id, c.email || c.userId || c.id)}
                      className="text-xs text-red-400 hover:text-red-600">Unblock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Block Contact</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email (optional)</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="spam@example.com"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">User ID (optional)</label>
                <input value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} placeholder="intercom_123"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white font-mono" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Spam / abuse"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
              <button onClick={block} className="px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">Block</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Health Tab ───────────────────────────────────────────────────────────────
interface HealthData {
  db: { ok: boolean; latencyMs: number };
  queues: { snoozed: number; kycPending: number };
  sessions: { active: number };
  system: { uptimeSecs: number; memMb: number; loadAvg: string };
}
interface AdminSession { id: string; userAgent: string | null; ip: string | null; createdAt: string; lastActiveAt: string; user: { name: string | null; email: string } }

function HealthTab() {
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [gdprUserId, setGdprUserId] = useState("");
  const [gdprLoading, setGdprLoading] = useState(false);

  async function loadHealth() {
    try { const r = await axios.get(`${API}/api/admin/health`); setHealth(r.data); } catch { /* */ }
  }
  async function loadSessions() {
    try { const r = await axios.get(`${API}/api/admin/health/sessions`); setSessions(r.data); } catch { /* */ }
  }
  useEffect(() => { loadHealth(); loadSessions(); }, []);

  async function revokeSession(id: string) {
    try { await axios.delete(`${API}/api/admin/health/sessions/${id}`); toast("Session revoked"); loadSessions(); }
    catch { toast("Failed", "error"); }
  }

  async function gdprExport() {
    if (!gdprUserId.trim()) return;
    setGdprLoading(true);
    try {
      const r = await axios.get(`${API}/api/admin/gdpr/export/${gdprUserId.trim()}`);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `gdpr-export-${gdprUserId.trim()}.json`; a.click();
      URL.revokeObjectURL(url);
      toast("GDPR export downloaded");
    } catch { toast("Export failed", "error"); }
    finally { setGdprLoading(false); }
  }

  async function gdprDelete() {
    if (!gdprUserId.trim()) return;
    if (!confirm(`Permanently anonymise all data for user ${gdprUserId.trim()}? This cannot be undone.`)) return;
    setGdprLoading(true);
    try {
      await axios.delete(`${API}/api/admin/gdpr/delete/${gdprUserId.trim()}`);
      toast("User data anonymised");
      setGdprUserId("");
    } catch { toast("Deletion failed", "error"); }
    finally { setGdprLoading(false); }
  }

  function fmtUptime(s: number) {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">System Health</h2>
          <button onClick={() => { loadHealth(); loadSessions(); }} className="text-xs text-blue-600 hover:underline">Refresh</button>
        </div>
        {health ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${health.db.ok ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Database</span>
              </div>
              <p className="text-xs text-gray-400">{health.db.ok ? `${health.db.latencyMs}ms` : "Unreachable"}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Active Sessions</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{health.sessions.active}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Snoozed Queue</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{health.queues.snoozed}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">KYC Pending</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{health.queues.kycPending}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Uptime</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmtUptime(health.system.uptimeSecs)}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Memory (RSS)</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{health.system.memMb}MB</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />)}</div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">Active Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400">No active sessions found.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{s.user.name || s.user.email}</p>
                  <p className="text-xs text-gray-400 truncate">{s.userAgent || "Unknown browser"} · {s.ip || "—"}</p>
                  <p className="text-xs text-gray-400">Last active: {new Date(s.lastActiveAt).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <button onClick={() => revokeSession(s.id)} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">Revoke</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-1">GDPR Data Management</h2>
        <p className="text-xs text-gray-400 mb-4">Export or erase a user&apos;s personal data (Right to Access / Right to Erasure)</p>
        <div className="flex items-center gap-2">
          <input value={gdprUserId} onChange={e => setGdprUserId(e.target.value)} placeholder="User ID (cuid)"
            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-mono dark:text-white" />
          <button onClick={gdprExport} disabled={!gdprUserId.trim() || gdprLoading}
            className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            {gdprLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Export JSON
          </button>
          <button onClick={gdprDelete} disabled={!gdprUserId.trim() || gdprLoading}
            className="px-3 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            Erase Data
          </button>
        </div>
      </div>
    </div>
  );
}
