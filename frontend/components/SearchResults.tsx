"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntercomContact {
  id?: string;
  email?: string;
  name?: string;
  phone?: string;
  last_seen_at?: number;
  signed_up_at?: number;
  conversation_count?: number;
  browser?: string;
  os?: string;
  location?: { country?: string; city?: string; timezone?: string };
  custom_attributes?: Record<string, unknown>;
  tags?: { tags: Array<{ id: string; name: string }> };
  unsubscribed_from_emails?: boolean;
}

interface GmailContact {
  id?: string;
  email?: string;
  name?: string;
  status?: string;
}

interface LuciqBug {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  email?: string;
  createdAt?: string;
}

interface SearchResult {
  gmail?: GmailContact[];
  intercom?: IntercomContact[];
  luciq?: LuciqBug[];
  timestamp?: string;
}

interface SearchResultsProps {
  results: SearchResult;
  query: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTs(unix?: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function priorityColor(p?: string) {
  if (p === "critical") return "bg-red-100 text-red-700";
  if (p === "high") return "bg-orange-100 text-orange-700";
  if (p === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}

// ─── Source-specific cards ────────────────────────────────────────────────────

function IntercomCard({ item }: { item: IntercomContact }) {
  const tags = item.tags?.tags ?? [];
  const attrs = item.custom_attributes ?? {};
  const attrEntries = Object.entries(attrs).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div className="border border-purple-100 rounded-xl p-4 hover:shadow-md transition bg-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {(item.name || item.email || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {item.name || "Unknown"}
            </p>
            <p className="text-xs text-gray-500">{item.email || item.id || "—"}</p>
          </div>
        </div>
        {item.conversation_count !== undefined && (
          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full border border-purple-200">
            {item.conversation_count} conv.
          </span>
        )}
      </div>

      {/* Details grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        {item.phone && (
          <>
            <span className="text-gray-400">Phone</span>
            <span>{item.phone}</span>
          </>
        )}
        {item.last_seen_at && (
          <>
            <span className="text-gray-400">Last seen</span>
            <span>{formatTs(item.last_seen_at)}</span>
          </>
        )}
        {item.signed_up_at && (
          <>
            <span className="text-gray-400">Signed up</span>
            <span>{formatTs(item.signed_up_at)}</span>
          </>
        )}
        {item.location?.city && (
          <>
            <span className="text-gray-400">Location</span>
            <span>
              {[item.location.city, item.location.country]
                .filter(Boolean)
                .join(", ")}
            </span>
          </>
        )}
        {item.browser && (
          <>
            <span className="text-gray-400">Browser</span>
            <span>{item.browser}</span>
          </>
        )}
        {item.os && (
          <>
            <span className="text-gray-400">OS</span>
            <span>{item.os}</span>
          </>
        )}
        {item.unsubscribed_from_emails && (
          <>
            <span className="text-gray-400">Email</span>
            <span className="text-red-500">Unsubscribed</span>
          </>
        )}
        {/* Custom attributes */}
        {attrEntries.map(([k, v]) => (
          <>
            <span key={`k-${k}`} className="text-gray-400 capitalize">
              {k.replace(/_/g, " ")}
            </span>
            <span key={`v-${k}`}>{String(v)}</span>
          </>
        ))}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t.id}
              className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GmailCard({ item }: { item: GmailContact }) {
  return (
    <div className="border border-blue-100 rounded-xl p-4 hover:shadow-md transition bg-white">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {(item.name || item.email || "?").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {item.name || "Unknown"}
            </p>
            <p className="text-xs text-gray-500">{item.email || item.id || "—"}</p>
          </div>
        </div>
        {item.status && (
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              item.status === "active"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {item.status}
          </span>
        )}
      </div>
    </div>
  );
}

function LuciqCard({ item }: { item: LuciqBug }) {
  return (
    <div className="border border-red-100 rounded-xl p-4 hover:shadow-md transition bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">
            {item.title || item.id || "Bug"}
          </p>
          {item.email && (
            <p className="text-xs text-gray-500 mt-0.5">{item.email}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.priority && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${priorityColor(
                item.priority
              )}`}
            >
              {item.priority}
            </span>
          )}
          {item.status && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                item.status === "open"
                  ? "bg-red-100 text-red-700"
                  : item.status === "in_progress"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {item.status}
            </span>
          )}
        </div>
      </div>
      {item.createdAt && (
        <p className="text-xs text-gray-400 mt-2">
          Reported{" "}
          {new Date(item.createdAt).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ResultSection({
  title,
  items,
  type,
}: {
  title: string;
  items: unknown[];
  type: "gmail" | "intercom" | "luciq";
}) {
  if (items.length === 0) {
    return (
      <p className="text-gray-400 text-sm text-center py-6">
        No {type} results found
      </p>
    );
  }

  return (
    <div>
      <h4 className="font-semibold text-gray-700 text-sm mb-3">{title}</h4>
      <div className="space-y-3">
        {items.map((item, idx) => {
          if (type === "intercom")
            return <IntercomCard key={idx} item={item as IntercomContact} />;
          if (type === "gmail")
            return <GmailCard key={idx} item={item as GmailContact} />;
          return <LuciqCard key={idx} item={item as LuciqBug} />;
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SearchResults({ results, query }: SearchResultsProps) {
  const [activeTab, setActiveTab] = useState<
    "all" | "gmail" | "intercom" | "luciq"
  >("all");

  const total =
    (results.gmail?.length ?? 0) +
    (results.intercom?.length ?? 0) +
    (results.luciq?.length ?? 0);

  const tabs = [
    { id: "all" as const, label: "All", count: total },
    { id: "gmail" as const, label: "Email", count: results.gmail?.length ?? 0, icon: "📧" },
    {
      id: "intercom" as const,
      label: "Intercom",
      count: results.intercom?.length ?? 0,
      icon: "💬",
    },
    { id: "luciq" as const, label: "Luciq", count: results.luciq?.length ?? 0, icon: "🐛" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-100 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-sm font-medium text-center transition ${
              activeTab === tab.id
                ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.icon && <span className="mr-1">{tab.icon}</span>}
            {tab.label}
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {query && (
          <p className="text-xs text-gray-400 mb-4">
            Results for <span className="font-medium text-gray-700">"{query}"</span>
          </p>
        )}

        {activeTab === "all" && (
          <div className="space-y-6">
            {(results.gmail?.length ?? 0) > 0 && (
              <ResultSection
                title="📧 Email"
                items={results.gmail!}
                type="gmail"
              />
            )}
            {(results.intercom?.length ?? 0) > 0 && (
              <ResultSection
                title="💬 Intercom"
                items={results.intercom!}
                type="intercom"
              />
            )}
            {(results.luciq?.length ?? 0) > 0 && (
              <ResultSection
                title="🐛 Luciq"
                items={results.luciq!}
                type="luciq"
              />
            )}
            {total === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                No results found across any platform
              </p>
            )}
          </div>
        )}

        {activeTab === "gmail" && (
          <ResultSection
            title="Email contacts"
            items={results.gmail ?? []}
            type="gmail"
          />
        )}
        {activeTab === "intercom" && (
          <ResultSection
            title="Intercom contacts"
            items={results.intercom ?? []}
            type="intercom"
          />
        )}
        {activeTab === "luciq" && (
          <ResultSection
            title="Luciq bugs"
            items={results.luciq ?? []}
            type="luciq"
          />
        )}
      </div>
    </div>
  );
}
