"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import Image from "next/image";
import { useAuth } from "@/components/AuthContext";
import { useToast } from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ─────────────────────────────────────────────────────────────────

interface NotifPrefs {
  emailOnAssign: boolean; emailOnMention: boolean; emailOnKycStatus: boolean;
  inAppOnAssign: boolean; inAppOnMention: boolean; inAppOnSlaWarning: boolean;
}

interface UserSession {
  id: string; userAgent: string | null; ip: string | null;
  createdAt: string; lastActiveAt: string;
}

// ─── TIMEZONES ─────────────────────────────────────────────────────────────

const TIMEZONES = [
  "Australia/Sydney","Australia/Melbourne","Australia/Brisbane","Australia/Perth",
  "Australia/Adelaide","Pacific/Auckland","America/New_York","America/Los_Angeles",
  "America/Chicago","Europe/London","Europe/Berlin","Asia/Tokyo","Asia/Singapore",
  "Asia/Dubai","America/Toronto",
];
const LOCALES = [
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-NZ", label: "English (New Zealand)" },
];

// ─── Rich Signature Editor ─────────────────────────────────────────────────

function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function execCmd(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        {[
          { icon: "B", cmd: "bold", title: "Bold", cls: "font-bold" },
          { icon: "I", cmd: "italic", title: "Italic", cls: "italic" },
          { icon: "U", cmd: "underline", title: "Underline", cls: "underline" },
        ].map(b => (
          <button key={b.cmd} title={b.title} onMouseDown={e => { e.preventDefault(); execCmd(b.cmd); }}
            className={`w-6 h-6 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 ${b.cls}`}>
            {b.icon}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />
        <button title="Link" onMouseDown={e => { e.preventDefault(); const url = prompt("URL:"); if (url) execCmd("createLink", url); }}
          className="w-6 h-6 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">🔗</button>
        <button title="Clear" onMouseDown={e => { e.preventDefault(); execCmd("removeFormat"); }}
          className="w-6 h-6 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">✕</button>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(editorRef.current?.innerHTML ?? "")}
        className="min-h-[100px] px-3 py-2 text-sm text-gray-700 dark:text-gray-300 dark:bg-gray-700 focus:outline-none"
        style={{ fontFamily: "inherit" }}
        data-placeholder="Kind regards,&#10;Your Name&#10;WeSupport Member Success"
      />
    </div>
  );
}

// ─── Toggle switch ──────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${on ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

// ─── Card wrapper ──────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  // Profile
  const [name, setName] = useState(user?.name || "");
  const [signatureHtml, setSignatureHtml] = useState("");
  const [saving, setSaving] = useState(false);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.image || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preferences
  const [timezone, setTimezone] = useState("Australia/Sydney");
  const [locale, setLocale] = useState("en-AU");

  // OOO
  const [oooEnabled, setOooEnabled] = useState(false);
  const [oooMessage, setOooMessage] = useState("");
  const [oooUntil, setOooUntil] = useState("");

  // Sound / desktop
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    emailOnAssign: true, emailOnMention: true, emailOnKycStatus: false,
    inAppOnAssign: true, inAppOnMention: true, inAppOnSlaWarning: true,
  });

  // 2FA
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<"idle" | "setup" | "disable">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await axios.get(`${API}/api/settings/sessions`);
      setSessions(res.data.sessions);
    } catch { /* ignore */ }
    finally { setSessionsLoading(false); }
  }, []);

  useEffect(() => {
    axios.get(`${API}/api/settings`).then(res => {
      setName(res.data.name || "");
      setSignatureHtml(res.data.signatureHtml || "");
      setAvatarPreview(res.data.image || "");
      setTimezone(res.data.timezone || "Australia/Sydney");
      setLocale(res.data.locale || "en-AU");
      setOooEnabled(!!res.data.oooEnabled);
      setOooMessage(res.data.oooMessage || "");
      setOooUntil(res.data.oooUntil ? res.data.oooUntil.split("T")[0] : "");
      setSoundNotifications(res.data.soundNotifications ?? true);
      setDesktopNotifications(res.data.desktopNotifications ?? false);
    }).catch(() => {});
    axios.get(`${API}/api/settings/notifications`).then(res => setNotifPrefs(res.data)).catch(() => {});
    fetchSessions();
  }, [fetchSessions]);

  // ─── Profile save ─────────────────────────────────────────────────────

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await axios.patch(`${API}/api/settings`, {
        name, signatureHtml,
        image: avatarPreview || null,
        timezone, locale,
        oooEnabled, oooMessage,
        oooUntil: oooUntil ? new Date(oooUntil).toISOString() : null,
        soundNotifications, desktopNotifications,
      });
      updateUser({ name: res.data.name });
      toast("Settings saved");
    } catch {
      toast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  // ─── Avatar upload ────────────────────────────────────────────────────

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("Image must be under 2MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ─── Theme toggle ─────────────────────────────────────────────────────

  async function toggleTheme(theme: "light" | "dark") {
    try {
      await axios.patch(`${API}/api/settings`, { theme });
      updateUser({ theme });
    } catch { toast("Failed to update theme", "error"); }
  }

  // ─── Desktop notifications permission ─────────────────────────────────

  async function requestDesktopPermission() {
    if (!("Notification" in window)) { toast("Desktop notifications not supported in this browser", "error"); return; }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setDesktopNotifications(true);
    } else {
      toast("Permission denied — check browser settings", "error");
      setDesktopNotifications(false);
    }
  }

  // ─── Notification prefs ────────────────────────────────────────────────

  async function toggleNotif(key: keyof NotifPrefs) {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try { await axios.patch(`${API}/api/settings/notifications`, { [key]: updated[key] }); }
    catch { setNotifPrefs(notifPrefs); toast("Failed", "error"); }
  }

  // ─── Password ─────────────────────────────────────────────────────────

  async function changePassword() {
    if (newPw !== confirmPw) { toast("Passwords don't match", "error"); return; }
    if (newPw.length < 6) { toast("Password must be at least 6 characters", "error"); return; }
    setPwSaving(true);
    try {
      await axios.patch(`${API}/api/settings/password`, { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      toast("Password updated");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed";
      toast(msg, "error");
    } finally { setPwSaving(false); }
  }

  // ─── 2FA ──────────────────────────────────────────────────────────────

  async function start2FaSetup() {
    setTwoFaLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/2fa/setup`);
      setQrDataUrl(res.data.qrDataUrl); setSecret(res.data.secret); setTotpToken("");
      setTwoFaStep("setup");
    } catch { toast("Failed to start 2FA setup", "error"); }
    finally { setTwoFaLoading(false); }
  }

  async function verify2Fa() {
    if (totpToken.length !== 6) { toast("Enter a 6-digit code", "error"); return; }
    setTwoFaLoading(true);
    try {
      await axios.post(`${API}/api/auth/2fa/verify`, { token: totpToken });
      setTwoFaEnabled(true); setTwoFaStep("idle"); setTotpToken(""); toast("2FA enabled");
    } catch { toast("Invalid code — try again", "error"); }
    finally { setTwoFaLoading(false); }
  }

  async function disable2Fa() {
    if (!disablePassword) { toast("Enter your password", "error"); return; }
    setTwoFaLoading(true);
    try {
      await axios.post(`${API}/api/auth/2fa/disable`, { password: disablePassword });
      setTwoFaEnabled(false); setTwoFaStep("idle"); setDisablePassword(""); toast("2FA disabled");
    } catch { toast("Incorrect password", "error"); }
    finally { setTwoFaLoading(false); }
  }

  // ─── Sessions ─────────────────────────────────────────────────────────

  async function revokeSession(id: string) {
    try {
      await axios.delete(`${API}/api/settings/sessions/${id}`);
      setSessions(prev => prev.filter(s => s.id !== id));
      toast("Session revoked");
    } catch { toast("Failed", "error"); }
  }

  async function revokeAllSessions() {
    if (!confirm("Sign out from all sessions?")) return;
    try {
      await axios.delete(`${API}/api/settings/sessions`);
      setSessions([]);
      toast("All sessions revoked");
    } catch { toast("Failed", "error"); }
  }

  const input = "w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-white";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-5">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Profile, preferences, security and notifications</p>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">

        {/* ── Profile ── */}
        <Card title="Profile">
          <div className="flex items-start gap-5 mb-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden cursor-pointer ring-2 ring-offset-2 ring-transparent hover:ring-blue-400 transition">
                {avatarPreview
                  ? <Image src={avatarPreview} alt="avatar" width={64} height={64} className="object-cover w-full h-full" unoptimized />
                  : <span className="text-xl font-bold text-blue-600">{(user?.name || user?.email || "U")[0].toUpperCase()}</span>
                }
              </div>
              <p className="text-xs text-gray-400 text-center mt-1 cursor-pointer hover:text-gray-600" onClick={() => fileInputRef.current?.click()}>Change</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            {/* Name + Email */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                <input type="email" value={user?.email || ""} disabled className={`${input} cursor-not-allowed opacity-60`} />
              </div>
            </div>
          </div>

          {/* Rich signature */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email Signature</label>
            <RichEditor value={signatureHtml} onChange={setSignatureHtml} />
          </div>

          <button onClick={saveProfile} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
            {saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Save Profile
          </button>
        </Card>

        {/* ── Regional Preferences ── */}
        <Card title="Regional Preferences">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className={input}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Language & Region</label>
              <select value={locale} onChange={e => setLocale(e.target.value)} className={input}>
                {LOCALES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            Save
          </button>
        </Card>

        {/* ── Theme ── */}
        <Card title="Appearance">
          <div className="grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map(t => (
              <button key={t} onClick={() => toggleTheme(t)}
                className={`p-4 rounded-xl border-2 transition text-left ${user?.theme === t ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-600 hover:border-gray-300"}`}>
                <div className={`w-8 h-8 rounded-lg mb-2 flex items-center justify-center text-lg ${t === "dark" ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
                  {t === "light" ? "☀️" : "🌙"}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{t}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* ── Out of Office ── */}
        <Card title="Out of Office">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">Enable auto-reply when out of office</p>
              <p className="text-xs text-gray-400">Replies automatically to incoming emails while you&apos;re away</p>
            </div>
            <Toggle on={oooEnabled} onChange={setOooEnabled} />
          </div>
          {oooEnabled && (
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Auto-reply message</label>
                <textarea value={oooMessage} onChange={e => setOooMessage(e.target.value)} rows={3}
                  placeholder="Thanks for reaching out! I'm currently out of office and will respond on my return."
                  className={`${input} font-normal resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Back in office on (optional)</label>
                <input type="date" value={oooUntil} onChange={e => setOooUntil(e.target.value)} className={input} />
              </div>
            </div>
          )}
          <button onClick={saveProfile} disabled={saving}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            Save
          </button>
        </Card>

        {/* ── Notifications ── */}
        <Card title="Notifications">
          <div className="space-y-1">
            {([
              { key: "emailOnAssign",     label: "Email when assigned to me",             group: "Email" },
              { key: "emailOnMention",    label: "Email when @mentioned in a note",        group: "Email" },
              { key: "emailOnKycStatus",  label: "Email on KYC case status change",        group: "Email" },
              { key: "inAppOnAssign",     label: "In-app alert when assigned",             group: "In-app" },
              { key: "inAppOnMention",    label: "In-app alert when @mentioned",           group: "In-app" },
              { key: "inAppOnSlaWarning", label: "In-app alert on SLA at-risk",            group: "In-app" },
            ] as Array<{ key: keyof NotifPrefs; label: string; group: string }>).map(({ key, label, group }, idx, arr) => {
              const showHeader = idx === 0 || arr[idx - 1].group !== group;
              return (
                <div key={key}>
                  {showHeader && <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1.5">{group}</p>}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    <Toggle on={notifPrefs[key]} onChange={() => toggleNotif(key)} />
                  </div>
                </div>
              );
            })}
            {/* Sound / Desktop */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1.5">Device</p>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">Sound on new message</span>
              <Toggle on={soundNotifications} onChange={v => { setSoundNotifications(v); saveProfile(); }} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Desktop push notifications</span>
                {!desktopNotifications && (
                  <button onClick={requestDesktopPermission} className="ml-2 text-xs text-blue-600 hover:underline">Enable</button>
                )}
              </div>
              <Toggle on={desktopNotifications} onChange={v => { setDesktopNotifications(v); saveProfile(); }} />
            </div>
          </div>
        </Card>

        {/* ── Password ── */}
        <Card title="Change Password">
          <div className="space-y-3 max-w-sm">
            <input type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className={input} />
            <input type="password" placeholder="New password (min 6 characters)" value={newPw} onChange={e => setNewPw(e.target.value)} className={input} />
            <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={input} />
            <button onClick={changePassword} disabled={pwSaving || !currentPw || !newPw || !confirmPw}
              className="px-4 py-2 bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition disabled:opacity-50 flex items-center gap-2">
              {pwSaving && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              Update Password
            </button>
          </div>
        </Card>

        {/* ── Two-Factor Authentication ── */}
        <Card title="Two-Factor Authentication">
          {twoFaEnabled && <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 mb-3">Active</span>}
          <p className="text-xs text-gray-400 mb-4">Add an extra layer of security using an authenticator app like Google Authenticator.</p>

          {twoFaStep === "idle" && !twoFaEnabled && (
            <button onClick={start2FaSetup} disabled={twoFaLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
              {twoFaLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Enable 2FA
            </button>
          )}

          {twoFaStep === "setup" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Scan the QR code with your authenticator app, then enter the 6-digit code.</p>
              {qrDataUrl && <div className="p-3 bg-white border border-gray-200 rounded-xl inline-block"><Image src={qrDataUrl} alt="2FA QR" width={180} height={180} /></div>}
              {secret && <p className="text-xs text-gray-500 font-mono bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">Manual: {secret}</p>}
              <div className="flex items-center gap-3 max-w-sm">
                <input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={totpToken}
                  onChange={e => setTotpToken(e.target.value.replace(/\D/g, ""))} className={`${input} font-mono`} />
                <button onClick={verify2Fa} disabled={twoFaLoading || totpToken.length !== 6}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                  {twoFaLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Verify
                </button>
                <button onClick={() => setTwoFaStep("idle")} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            </div>
          )}

          {twoFaEnabled && twoFaStep === "idle" && (
            <button onClick={() => setTwoFaStep("disable")}
              className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 border border-red-200 transition">
              Disable 2FA
            </button>
          )}

          {twoFaStep === "disable" && (
            <div className="space-y-3 max-w-sm">
              <p className="text-sm text-gray-600">Confirm your password to disable 2FA.</p>
              <input type="password" placeholder="Current password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} className={input} />
              <div className="flex gap-2">
                <button onClick={disable2Fa} disabled={twoFaLoading || !disablePassword}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                  {twoFaLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Confirm
                </button>
                <button onClick={() => { setTwoFaStep("idle"); setDisablePassword(""); }} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Active Sessions ── */}
        <Card title="Active Sessions">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</p>
            {sessions.length > 1 && (
              <button onClick={revokeAllSessions} className="text-xs text-red-500 hover:text-red-700">Sign out all</button>
            )}
          </div>
          {sessionsLoading ? (
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-400">No active sessions found.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-base flex-shrink-0">
                    {(s.userAgent || "").toLowerCase().includes("mobile") ? "📱" : "💻"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                      {s.userAgent ? s.userAgent.slice(0, 60) : "Unknown browser"}
                      {i === 0 && <span className="ml-2 text-green-600 font-semibold">• Current</span>}
                    </p>
                    <p className="text-xs text-gray-400">{s.ip || "Unknown IP"} · Last active {new Date(s.lastActiveAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  {i !== 0 && (
                    <button onClick={() => revokeSession(s.id)} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">Revoke</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button onClick={fetchSessions} className="mt-3 text-xs text-blue-600 hover:underline">Refresh</button>
        </Card>

      </div>
    </div>
  );
}
