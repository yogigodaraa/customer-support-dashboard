"use client";

interface Bar {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
}

interface Props {
  bars: Bar[];
  maxValue?: number;
  /** Show value labels on bars */
  showValues?: boolean;
  valueFormatter?: (v: number) => string;
}

export default function HBarChart({
  bars,
  maxValue,
  showValues = true,
  valueFormatter = v => String(v),
}: Props) {
  if (!bars.length) return null;
  const max = maxValue ?? Math.max(...bars.map(b => b.value), 1);

  return (
    <div className="space-y-2.5">
      {bars.map((bar, i) => {
        const pct = Math.min((bar.value / max) * 100, 100);
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 truncate max-w-[65%]">{bar.label}</span>
              {showValues && (
                <span className="text-xs font-semibold text-gray-800 flex-shrink-0 ml-2">
                  {valueFormatter(bar.value)}{bar.suffix ?? ""}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: bar.color ?? "#3B82F6",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
