"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useToast } from "./Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SnoozeButtonProps {
  channel: string;
  externalId: string;
  snoozedUntil?: string | null;
  onChanged?: (snoozedUntil: string | null) => void;
}

function formatSnoozeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const isTomorrow = (() => {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return (
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate()
    );
  })();

  const timeStr = date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `today at ${timeStr}`;
  if (isTomorrow) return `tomorrow at ${timeStr}`;

  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function computeNextMonday9am(): Date {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day; // if Sunday, 1 day; else next week's Monday
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

function computeTomorrow9am(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Format a Date as "YYYY-MM-DDTHH:MM" for datetime-local input value
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

export default function SnoozeButton({
  channel,
  externalId,
  snoozedUntil,
  onChanged,
}: SnoozeButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customValue, setCustomValue] = useState<string>(() =>
    toDatetimeLocalValue(new Date(Date.now() + 3600 * 1000))
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Dismiss dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function snooze(until: Date) {
    if (loading) return;
    setLoading(true);
    const isoString = until.toISOString();
    try {
      await axios.post(`${API}/api/meta/${channel}/${externalId}/snooze`, {
        until: isoString,
      });
      onChanged?.(isoString);
      toast(`Snoozed until ${formatSnoozeTime(isoString)}`);
      setOpen(false);
    } catch {
      toast("Failed to snooze conversation", "error");
    } finally {
      setLoading(false);
    }
  }

  async function clearSnooze() {
    if (loading) return;
    setLoading(true);
    try {
      await axios.delete(`${API}/api/meta/${channel}/${externalId}/snooze`);
      onChanged?.(null);
      toast("Snooze cleared");
    } catch {
      toast("Failed to clear snooze", "error");
    } finally {
      setLoading(false);
    }
  }

  function handlePreset(preset: string) {
    let until: Date;
    const now = new Date();
    switch (preset) {
      case "1h":
        until = new Date(now.getTime() + 1 * 3600 * 1000);
        break;
      case "4h":
        until = new Date(now.getTime() + 4 * 3600 * 1000);
        break;
      case "tomorrow":
        until = computeTomorrow9am();
        break;
      case "nextweek":
        until = computeNextMonday9am();
        break;
      default:
        return;
    }
    snooze(until);
  }

  function handleCustomSubmit() {
    if (!customValue) return;
    const d = new Date(customValue);
    if (isNaN(d.getTime())) {
      toast("Invalid date/time", "error");
      return;
    }
    if (d <= new Date()) {
      toast("Please pick a future time", "error");
      return;
    }
    snooze(d);
  }

  // ── Snoozed state ────────────────────────────────────────────────────────────
  if (snoozedUntil) {
    return (
      <span className="bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full px-3 py-1 text-xs flex items-center gap-1.5">
        {/* Moon/sleep icon */}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-3.5 h-3.5 flex-shrink-0"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
        <span>Snoozed until {formatSnoozeTime(snoozedUntil)}</span>
        <button
          type="button"
          onClick={clearSnooze}
          disabled={loading}
          className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-yellow-200 transition disabled:opacity-40 ml-0.5"
          title="Clear snooze"
          aria-label="Clear snooze"
        >
          {loading ? (
            <span className="w-2.5 h-2.5 border border-yellow-700 border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            <svg
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              className="w-2.5 h-2.5"
            >
              <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </span>
    );
  }

  // ── Not snoozed state ────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition disabled:opacity-40"
      >
        {loading ? (
          <span className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          /* Clock icon */
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            className="w-3.5 h-3.5"
          >
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        Snooze
      </button>

      {open && (
        <div className="absolute z-30 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-48">
          {/* Preset options */}
          <button
            type="button"
            onClick={() => handlePreset("1h")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition"
          >
            In 1 hour
          </button>
          <button
            type="button"
            onClick={() => handlePreset("4h")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition"
          >
            In 4 hours
          </button>
          <button
            type="button"
            onClick={() => handlePreset("tomorrow")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition"
          >
            Tomorrow 9am
          </button>
          <button
            type="button"
            onClick={() => handlePreset("nextweek")}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition"
          >
            Next week
          </button>

          {/* Custom date+time picker */}
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Custom</p>
            <input
              type="datetime-local"
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleCustomSubmit();
                if (e.key === "Escape") setOpen(false);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              className="w-full text-xs bg-gray-900 text-white py-1.5 rounded-lg hover:bg-gray-700 transition"
            >
              Set snooze
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
