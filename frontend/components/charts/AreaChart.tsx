"use client";

import { useState } from "react";

interface DataPoint {
  day: string;
  gmail: number;
  intercom: number;
  luciq: number;
  total: number;
}

interface Props {
  data: DataPoint[];
  height?: number;
}

const SERIES = [
  { key: "gmail"   as const, label: "Email",    color: "#3B82F6" },
  { key: "intercom"as const, label: "Intercom", color: "#8B5CF6" },
  { key: "luciq"   as const, label: "Luciq",    color: "#EF4444" },
];

function smooth(pts: { x: number; y: number }[]): string {
  return pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cpx = ((prev.x + pt.x) / 2).toFixed(1);
    return `${acc} C ${cpx},${prev.y.toFixed(1)} ${cpx},${pt.y.toFixed(1)} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }, "");
}

export default function AreaChart({ data, height = 200 }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const padL = 32, padR = 12, padT = 12, padB = 28;
  const W = 520, H = height;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const yTicks = 4;

  function xOf(i: number) { return padL + (i / (data.length - 1)) * chartW; }
  function yOf(v: number) { return padT + chartH - (v / maxVal) * chartH; }

  return (
    <div className="relative w-full">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        {SERIES.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: s.color }} />
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ height }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          {SERIES.map(s => (
            <linearGradient key={s.key} id={`area-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Y-axis grid lines */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = Math.round((maxVal / yTicks) * i);
          const y = yOf(v);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth="1" />
              <text x={padL - 6} y={y + 4} fontSize="10" fill="#9CA3AF" textAnchor="end">{v}</text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xOf(i)}
            y={H - padB + 16}
            fontSize="10"
            fill={hoverIdx === i ? "#374151" : "#9CA3AF"}
            textAnchor="middle"
            fontWeight={hoverIdx === i ? "600" : "400"}
          >
            {d.day}
          </text>
        ))}

        {/* Series areas + lines (back to front so front is on top) */}
        {[...SERIES].reverse().map(s => {
          const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d[s.key]) }));
          const linePath = smooth(pts);
          const last = pts[pts.length - 1];
          const first = pts[0];
          const fillPath = `${linePath} L ${last.x},${padT + chartH} L ${first.x},${padT + chartH} Z`;
          return (
            <g key={s.key}>
              <path d={fillPath} fill={`url(#area-grad-${s.key})`} />
              <path d={linePath} stroke={s.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}

        {/* Hover vertical line */}
        {hoverIdx !== null && (
          <line
            x1={xOf(hoverIdx)}
            y1={padT}
            x2={xOf(hoverIdx)}
            y2={padT + chartH}
            stroke="#E5E7EB"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        )}

        {/* Hover dots */}
        {hoverIdx !== null && SERIES.map(s => {
          const d = data[hoverIdx];
          const y = yOf(d[s.key]);
          return (
            <circle key={s.key} cx={xOf(hoverIdx)} cy={y} r="4" fill={s.color} stroke="white" strokeWidth="2" />
          );
        })}

        {/* Invisible hover targets */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={xOf(i) - chartW / (data.length * 2)}
            y={padT}
            width={chartW / data.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            style={{ cursor: "crosshair" }}
          />
        ))}

        {/* Hover tooltip */}
        {hoverIdx !== null && (() => {
          const d = data[hoverIdx];
          const x = xOf(hoverIdx);
          const tipX = x > W * 0.65 ? x - 88 : x + 10;
          return (
            <g>
              <rect x={tipX} y={padT} width={82} height={72} rx="6" fill="#1F2937" opacity="0.92" />
              <text x={tipX + 8} y={padT + 14} fontSize="10" fill="white" fontWeight="600">{d.day} · {d.total} total</text>
              {SERIES.map((s, si) => (
                <g key={s.key}>
                  <circle cx={tipX + 12} cy={padT + 26 + si * 15} r="3" fill={s.color} />
                  <text x={tipX + 20} y={padT + 30 + si * 15} fontSize="10" fill="#D1D5DB">
                    {s.label}: {d[s.key]}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
