"use client";

interface StatCardProps {
  label: string;
  value: number | null;
  icon: string;
  color: "amber" | "blue" | "green" | "purple" | "red" | "indigo";
  sublabel?: string;
  isLoading?: boolean;
}

const colorMap = {
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "bg-amber-100 text-amber-700",
    value: "text-amber-700",
    label: "text-amber-600",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "bg-blue-100 text-blue-700",
    value: "text-blue-700",
    label: "text-blue-600",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "bg-green-100 text-green-700",
    value: "text-green-700",
    label: "text-green-600",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: "bg-purple-100 text-purple-700",
    value: "text-purple-700",
    label: "text-purple-600",
  },
  red: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "bg-red-100 text-red-700",
    value: "text-red-700",
    label: "text-red-600",
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    icon: "bg-indigo-100 text-indigo-700",
    value: "text-indigo-700",
    label: "text-indigo-600",
  },
};

export default function StatCard({
  label,
  value,
  icon,
  color,
  sublabel,
  isLoading = false,
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5 flex items-start gap-4`}>
      <div className={`text-2xl w-12 h-12 rounded-lg ${c.icon} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        {isLoading ? (
          <div className="h-9 w-16 bg-gray-200 rounded animate-pulse mb-1" />
        ) : (
          <p className={`text-3xl font-bold leading-tight ${c.value}`}>
            {value ?? "—"}
          </p>
        )}
        <p className={`text-sm font-medium ${c.label} truncate`}>{label}</p>
        {sublabel && (
          <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
