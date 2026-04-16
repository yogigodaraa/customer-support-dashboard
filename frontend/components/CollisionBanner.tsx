"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useWebSocket } from "./WebSocketContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollisionBannerProps {
  channel: string;
  externalId: string;
}

interface ViewingAgent {
  userId: string;
  name: string;
  email?: string;
}

// ─── Payload shapes coming from the server ────────────────────────────────────

interface AgentJoinedPayload {
  externalId: string;
  channel?: string;
  userId: string;
  name: string;
  email?: string;
}

interface AgentLeftPayload {
  externalId: string;
  channel?: string;
  userId: string;
}

interface AgentTypingPayload {
  externalId: string;
  channel?: string;
  userId: string;
  name: string;
}

// ─── Animated typing dots ─────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5 ml-0.5">
      <span className="w-1 h-1 rounded-full bg-yellow-600 animate-pulse" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 rounded-full bg-yellow-600 animate-pulse" style={{ animationDelay: "200ms" }} />
      <span className="w-1 h-1 rounded-full bg-yellow-600 animate-pulse" style={{ animationDelay: "400ms" }} />
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CollisionBanner({ channel, externalId }: CollisionBannerProps) {
  const { on, off, emit, isConnected } = useWebSocket();

  const [viewingAgents, setViewingAgents] = useState<ViewingAgent[]>([]);
  const [typingAgent, setTypingAgent] = useState<string | null>(null);

  // Keep a ref to the clear-typing timer so we can reset it on each new event
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Presence: announce on mount / leave on unmount ───────────────────────

  useEffect(() => {
    // Only emit once the socket is actually connected. If it connects later,
    // the effect will re-run because isConnected is in the dependency array.
    if (!isConnected) return;

    emit("presence:viewing", { channel, externalId });

    return () => {
      emit("presence:left", { channel, externalId });
    };
  }, [emit, channel, externalId, isConnected]);

  // ── WebSocket event handlers ──────────────────────────────────────────────

  const handleAgentJoined = useCallback(
    (payload: AgentJoinedPayload) => {
      if (
        payload.externalId !== externalId ||
        (payload.channel && payload.channel !== channel)
      ) {
        return;
      }

      setViewingAgents(prev => {
        // Avoid duplicates — replace if already present (name may have changed)
        const filtered = prev.filter(a => a.userId !== payload.userId);
        return [
          ...filtered,
          { userId: payload.userId, name: payload.name, email: payload.email },
        ];
      });
    },
    [channel, externalId]
  );

  const handleAgentLeft = useCallback(
    (payload: AgentLeftPayload) => {
      if (
        payload.externalId !== externalId ||
        (payload.channel && payload.channel !== channel)
      ) {
        return;
      }

      setViewingAgents(prev => prev.filter(a => a.userId !== payload.userId));

      // If the leaving agent was the one typing, clear the typing indicator
      setTypingAgent(prev => {
        if (!prev) return prev;
        // We don't have the name here, so we can't easily match. Just leave it;
        // it will auto-clear via the timer anyway. But if there's no one else
        // viewing after removal, clear it proactively.
        return prev;
      });
    },
    [channel, externalId]
  );

  const handleAgentTyping = useCallback(
    (payload: AgentTypingPayload) => {
      if (
        payload.externalId !== externalId ||
        (payload.channel && payload.channel !== channel)
      ) {
        return;
      }

      setTypingAgent(payload.name);

      // Auto-clear after 3 seconds of no further typing events
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setTypingAgent(null);
      }, 3000);
    },
    [channel, externalId]
  );

  // Register / deregister listeners
  useEffect(() => {
    on("presence:agent_joined", handleAgentJoined);
    on("presence:agent_left", handleAgentLeft);
    on("presence:agent_typing", handleAgentTyping);

    return () => {
      off("presence:agent_joined", handleAgentJoined);
      off("presence:agent_left", handleAgentLeft);
      off("presence:agent_typing", handleAgentTyping);

      // Clear the typing timer on unmount to avoid state updates on an
      // unmounted component
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [on, off, handleAgentJoined, handleAgentLeft, handleAgentTyping]);

  // Clear viewing agents when conversation changes so stale state doesn't bleed
  // across conversations
  useEffect(() => {
    setViewingAgents([]);
    setTypingAgent(null);
  }, [channel, externalId]);

  // ── Render ────────────────────────────────────────────────────────────────

  const hasActivity = viewingAgents.length > 0 || typingAgent !== null;
  if (!hasActivity) return null;

  // Typing takes priority over the viewing message
  if (typingAgent) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-3 py-2 text-sm mb-2"
      >
        {/* Pencil icon */}
        <svg
          className="w-3.5 h-3.5 flex-shrink-0 text-yellow-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H7v-3a2 2 0 01.586-1.414z"
          />
        </svg>
        <span>
          <span className="font-semibold">{typingAgent}</span> is typing
          <TypingDots />
        </span>
      </div>
    );
  }

  // Build display text for viewing agents
  const names = viewingAgents.map(a => a.name);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl px-3 py-2 text-sm mb-2"
    >
      {/* Warning icon */}
      <svg
        className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      <span>
        ⚠{" "}
        <span className="font-semibold">{names[0]}</span>
        {names.length > 1 && (
          <>
            {" "}and{" "}
            <span className="font-semibold">
              {names.length === 2
                ? names[1]
                : `${names.length - 1} others`}
            </span>
          </>
        )}{" "}
        {names.length === 1 ? "is" : "are"} also viewing this conversation
      </span>
    </div>
  );
}
