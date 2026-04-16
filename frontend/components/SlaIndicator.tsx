"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useToast } from "./Toast";
import { useWebSocket } from "./WebSocketContext";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SlaMetric {
  targetMins: number | null;
  actualMins: number | null;
  status: string;
}

interface SlaStatus {
  frt: SlaMetric;
  resolution: SlaMetric;
}

interface SlaIndicatorProps {
  channel: string;
  externalId: string;
}

type SlaStatusKey = "on_time" | "at_risk" | "breached" | "unknown";

const STATUS_CLASSES: Record<SlaStatusKey, string> = {
  on_time: "bg-green-50 text-green-700 border-green-200",
  at_risk:  "bg-yellow-50 text-yellow-700 border-yellow-200",
  breached: "bg-red-50 text-red-700 border-red-200",
  unknown:  "bg-gray-50 text-gray-500 border-gray-200",
};

function pillClasses(status: string): string {
  const key = status as SlaStatusKey;
  return STATUS_CLASSES[key] ?? STATUS_CLASSES.unknown;
}

function formatMins(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function SlaIndicator({ channel, externalId }: SlaIndicatorProps) {
  const [sla, setSla] = useState<SlaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { on, off } = useWebSocket();

  const fetchSla = useCallback(async () => {
    try {
      const res = await axios.get<SlaStatus>(
        `${API}/api/sla/status/${encodeURIComponent(channel)}/${encodeURIComponent(externalId)}`
      );
      setSla(res.data);
    } catch {
      // silently ignore — no SLA policy or unavailable
      setSla(null);
    } finally {
      setLoading(false);
    }
  }, [channel, externalId]);

  useEffect(() => {
    fetchSla();
  }, [fetchSla]);

  useEffect(() => {
    function handleWarning(data: { channel?: string; externalId?: string }) {
      if (data?.channel === channel && data?.externalId === externalId) {
        fetchSla();
      }
    }

    function handleBreached(data: { channel?: string; externalId?: string }) {
      if (data?.channel === channel && data?.externalId === externalId) {
        toast("SLA breached", "error");
        fetchSla();
      }
    }

    on("sla:warning", handleWarning);
    on("sla:breached", handleBreached);

    return () => {
      off("sla:warning", handleWarning);
      off("sla:breached", handleBreached);
    };
  }, [channel, externalId, on, off, toast, fetchSla]);

  if (loading) return null;
  if (!sla) return null;

  // If no SLA policy exists for either metric, render nothing
  const hasFrt = sla.frt.targetMins !== null;
  const hasResolution = sla.resolution.targetMins !== null;
  if (!hasFrt && !hasResolution) return null;

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {hasFrt && (
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${pillClasses(sla.frt.status)}`}
          title={
            sla.frt.targetMins !== null
              ? `FRT target: ${formatMins(sla.frt.targetMins)}`
              : "No FRT target"
          }
        >
          FRT: {formatMins(sla.frt.actualMins)}
        </span>
      )}
      {hasResolution && (
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${pillClasses(sla.resolution.status)}`}
          title={
            sla.resolution.targetMins !== null
              ? `Resolution target: ${formatMins(sla.resolution.targetMins)}`
              : "No resolution target"
          }
        >
          Res: {formatMins(sla.resolution.actualMins)}
        </span>
      )}
    </span>
  );
}
