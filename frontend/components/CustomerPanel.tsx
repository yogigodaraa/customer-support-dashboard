"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Props {
  email: string;
  name: string;
}

function formatTs(unix?: number | null) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 py-0.5">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-700 text-right break-all">{value}</span>
    </div>
  );
}

function CopyableText({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <span className={`group/copy inline-flex items-center gap-1 min-w-0 ${className || ""}`}>
      <span className="truncate">{text}</span>
      <button
        onClick={handleCopy}
        title="Copy"
        className="flex-shrink-0 opacity-0 group-hover/copy:opacity-100 transition-opacity text-gray-300 hover:text-gray-500"
      >
        {copied ? (
          <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} />
          </svg>
        )}
      </button>
    </span>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <p className={`text-xs font-semibold ${color} mb-2`}>{title}</p>
      {children}
    </div>
  );
}

export default function CustomerPanel({ email, name }: Props) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    setError(false);
    setData(null);
    axios.post(`${API}/api/search`, { email })
      .then(res => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [email]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intercom = Array.isArray((data as any)?.intercom) ? (data as any).intercom[0] : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gmail = Array.isArray((data as any)?.gmail) ? (data as any).gmail[0] : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const luciq: unknown[] = Array.isArray((data as any)?.luciq) ? (data as any).luciq : [];

  const avatarLetters = name
    .split(" ")
    .map(w => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="w-60 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer Profile</p>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
            </div>
          </div>
          {[1,2,3,4].map(i => <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">

          {/* Identity */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                {avatarLetters}
              </div>
              <div className="min-w-0">
                <CopyableText text={name} className="text-sm font-semibold text-gray-900" />
                <CopyableText text={email} className="text-xs text-gray-400" />
              </div>
            </div>
          </div>

          {/* Intercom section */}
          {intercom && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Section title="Intercom" color="text-purple-600">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).phone && <InfoRow label="Phone" value={(intercom as any).phone} />}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).signed_up_at && <InfoRow label="Signed up" value={formatTs((intercom as any).signed_up_at)} />}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).last_seen_at && <InfoRow label="Last seen" value={formatTs((intercom as any).last_seen_at)} />}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).conversation_count != null && (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <InfoRow label="Conversations" value={String((intercom as any).conversation_count)} />
              )}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).location?.city && (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <InfoRow label="Location" value={`${(intercom as any).location.city}, ${(intercom as any).location.country ?? ""}`} />
              )}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).browser && <InfoRow label="Browser" value={(intercom as any).browser} />}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).os && <InfoRow label="OS" value={(intercom as any).os} />}
              {/* Tags */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {Array.isArray((intercom as any).tags?.tags) && (intercom as any).tags.tags.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-xs text-gray-400 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(intercom as any).tags.tags.map((t: any) => (
                      <span key={t.id ?? t.name} className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Custom attributes */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(intercom as any).custom_attributes && Object.keys((intercom as any).custom_attributes).length > 0 && (
                <div className="mt-1.5">
                  <p className="text-xs text-gray-400 mb-1">Custom</p>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {Object.entries((intercom as any).custom_attributes).slice(0, 4).map(([k, v]) => (
                    <InfoRow key={k} label={k.replace(/_/g, " ")} value={String(v ?? "—")} />
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Gmail section */}
          {gmail && (
            <Section title="Gmail" color="text-blue-600">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <InfoRow label="Name" value={(gmail as any).name && (gmail as any).name !== (gmail as any).email?.split("@")[0] ? (gmail as any).name : name} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(gmail as any).email && <InfoRow label="Email" value={(gmail as any).email} />}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(gmail as any).channel && <InfoRow label="Channel" value={(gmail as any).channel === "kyc" ? "KYC" : "Support"} />}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(gmail as any).status && <InfoRow label="Status" value={(gmail as any).status} />}
            </Section>
          )}

          {/* Luciq bugs */}
          {luciq.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-orange-600 mb-2">Luciq Bugs ({luciq.length})</p>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {luciq.slice(0, 4).map((bug: any) => (
                  <div key={bug.id} className="text-xs border border-gray-100 rounded-lg p-2">
                    <p className="text-gray-800 font-medium truncate">{bug.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        bug.priority === "critical" ? "bg-red-100 text-red-700" :
                        bug.priority === "high"     ? "bg-orange-100 text-orange-700" :
                        bug.priority === "medium"   ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{bug.priority}</span>
                      <span className="text-gray-400">{bug.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!intercom && !gmail && luciq.length === 0 && !loading && !error && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No profile data found</p>
              <p className="text-xs text-gray-300 mt-1">{email}</p>
            </div>
          )}

          {error && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">Could not load profile</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
