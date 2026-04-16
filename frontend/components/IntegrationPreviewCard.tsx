"use client";

import Link from "next/link";

interface Stat {
  label: string;
  value: number;
}

interface IntegrationPreviewCardProps {
  title: string;
  icon: string;
  href: string;
  stats: Stat[];
  accentColor: "blue" | "purple" | "red";
  isLoading?: boolean;
}

const accent = {
  blue: {
    header: "bg-blue-600",
    badge: "bg-blue-100 text-blue-700",
    link: "text-blue-600 hover:text-blue-800",
  },
  purple: {
    header: "bg-purple-600",
    badge: "bg-purple-100 text-purple-700",
    link: "text-purple-600 hover:text-purple-800",
  },
  red: {
    header: "bg-red-500",
    badge: "bg-red-100 text-red-700",
    link: "text-red-600 hover:text-red-800",
  },
};

export default function IntegrationPreviewCard({
  title,
  icon,
  href,
  stats,
  accentColor,
  isLoading = false,
}: IntegrationPreviewCardProps) {
  const c = accent[accentColor];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      {/* Colored header */}
      <div className={`${c.header} px-5 py-4 flex items-center gap-3`}>
        <span className="text-2xl">{icon}</span>
        <span className="text-white font-semibold text-base">{title}</span>
      </div>

      {/* Stats list */}
      <div className="px-5 py-4 flex-1 space-y-3">
        {isLoading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-5 w-8 bg-gray-100 rounded animate-pulse" />
              </div>
            ))
          : stats.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${c.badge}`}>
                  {value}
                </span>
              </div>
            ))}
      </div>

      {/* Footer link */}
      <div className="px-5 py-3 border-t border-gray-100">
        <Link
          href={href}
          className={`text-sm font-medium ${c.link} flex items-center gap-1`}
        >
          View all details <span>→</span>
        </Link>
      </div>
    </div>
  );
}
