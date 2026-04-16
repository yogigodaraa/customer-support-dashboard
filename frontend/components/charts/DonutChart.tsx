"use client";

import { useState } from "react";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  thickness?: number;
}

export default function DonutChart({ segments, size = 160, thickness = 32 }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  const slices = segments.map((seg, i) => {
    const fraction = seg.value / total;
    const offset = circumference - cumulative * circumference;
    const dashArray = `${fraction * circumference} ${circumference}`;
    cumulative += fraction;
    return { ...seg, dashArray, offset, fraction, i };
  });

  return (
    <div className="flex items-center gap-5">
      {/* Donut SVG */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth={thickness}
          />
          {/* Segments */}
          {slices.map(sl => (
            <circle
              key={sl.i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={sl.color}
              strokeWidth={hovered === sl.i ? thickness + 4 : thickness}
              strokeDasharray={sl.dashArray}
              strokeDashoffset={sl.offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-width 0.15s ease", cursor: "pointer" }}
              onMouseEnter={() => setHovered(sl.i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered !== null ? (
            <>
              <span className="text-lg font-bold text-gray-900">{segments[hovered].value}</span>
              <span className="text-xs text-gray-400">{Math.round((segments[hovered].value / total) * 100)}%</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold text-gray-900">{total}</span>
              <span className="text-xs text-gray-400">total</span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0">
        {segments.map((seg, i) => {
          const pct = Math.round((seg.value / total) * 100);
          return (
            <div
              key={i}
              className={`flex items-center gap-2 cursor-default transition-opacity ${
                hovered !== null && hovered !== i ? "opacity-40" : "opacity-100"
              }`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-xs text-gray-600 truncate flex-1">{seg.label}</span>
              <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
