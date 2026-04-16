"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const STARS = [1, 2, 3, 4, 5] as const;
const STAR_LABELS: Record<number, string> = {
  1: "Very dissatisfied",
  2: "Dissatisfied",
  3: "Neutral",
  4: "Satisfied",
  5: "Very satisfied",
};
const STAR_COLOR = (score: number) =>
  score >= 4 ? "#F59E0B" : score === 3 ? "#94A3B8" : "#EF4444";

function CsatForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  type Phase = "loading" | "not_found" | "done_before" | "rate" | "thanks" | "error";

  const [phase, setPhase] = useState<Phase>("loading");
  const [channel, setChannel] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [prevScore, setPrevScore] = useState<number | null>(null);

  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setPhase("not_found"); return; }
    axios
      .get(`${API}/api/csat/respond/${token}`)
      .then(res => {
        setChannel(res.data.channel || "");
        setCustomerEmail(res.data.customerEmail || "");
        if (res.data.alreadyResponded) {
          setPrevScore(res.data.score);
          setPhase("done_before");
        } else {
          setPhase("rate");
        }
      })
      .catch(err => {
        if (err.response?.status === 404) setPhase("not_found");
        else setPhase("error");
      });
  }, [token]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/csat/respond/${token}`, { score: selected, feedback: feedback || undefined });
      setPhase("thanks");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) setPhase("done_before");
      else setPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  const displayStar = hovered || selected;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header strip */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <div className="px-8 py-10">
          {/* Logo / brand */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">W</div>
            <span className="text-sm font-semibold text-gray-700">WeSupport</span>
          </div>

          {/* Loading */}
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading survey…</p>
            </div>
          )}

          {/* Not found */}
          {phase === "not_found" && (
            <div className="text-center py-6">
              <p className="text-4xl mb-4">🔍</p>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Survey not found</h2>
              <p className="text-sm text-gray-500">
                This link may be invalid or expired. Please contact us at{" "}
                <a href="mailto:support@wesupport.com.au" className="text-blue-600 hover:underline">support@wesupport.com.au</a>.
              </p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="text-center py-6">
              <p className="text-4xl mb-4">⚠️</p>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h2>
              <p className="text-sm text-gray-500">Please try refreshing the page or contact us if the problem persists.</p>
            </div>
          )}

          {/* Already responded */}
          {phase === "done_before" && (
            <div className="text-center py-6">
              <p className="text-5xl mb-4">✅</p>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Already submitted</h2>
              {prevScore && (
                <p className="text-sm text-gray-500 mb-1">
                  You rated this interaction <strong>{prevScore}/5</strong> — {STAR_LABELS[prevScore]}.
                </p>
              )}
              <p className="text-sm text-gray-400">Thank you for your feedback!</p>
            </div>
          )}

          {/* Rate */}
          {phase === "rate" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">How did we do?</h2>
              {customerEmail && (
                <p className="text-sm text-gray-500 mb-6">
                  Hi <span className="font-medium text-gray-700">{customerEmail}</span> — we&apos;d love to hear about your recent{" "}
                  {channel ? <span className="font-medium">{channel}</span> : "support"} experience.
                </p>
              )}

              {/* Star selector */}
              <div className="flex justify-center gap-3 mb-3">
                {STARS.map(n => (
                  <button
                    key={n}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setSelected(n)}
                    className="text-4xl transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                    aria-label={STAR_LABELS[n]}
                  >
                    <span style={{ color: n <= displayStar ? STAR_COLOR(displayStar) : "#E2E8F0", filter: n <= displayStar ? "drop-shadow(0 0 4px rgba(245,158,11,0.4))" : "none" }}>
                      ★
                    </span>
                  </button>
                ))}
              </div>

              {/* Label */}
              <p className="text-center text-sm text-gray-400 h-5 mb-6 transition-all">
                {displayStar ? STAR_LABELS[displayStar] : ""}
              </p>

              {/* Feedback textarea */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Additional comments <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="Tell us what went well or what we could improve…"
                  maxLength={1000}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-gray-700 placeholder-gray-300"
                />
                {feedback.length > 0 && (
                  <p className="text-right text-xs text-gray-300 mt-0.5">{feedback.length}/1000</p>
                )}
              </div>

              <button
                onClick={submit}
                disabled={!selected || submitting}
                className="w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Submit Feedback
              </button>
            </div>
          )}

          {/* Thanks */}
          {phase === "thanks" && (
            <div className="text-center py-6">
              <div className="text-6xl mb-4">
                {selected >= 4 ? "🎉" : selected === 3 ? "🙏" : "💙"}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {selected >= 4 ? "You made our day!" : "Thank you for your honesty"}
              </h2>
              <p className="text-sm text-gray-500 mb-1">
                Your rating of <strong>{selected}/5</strong> has been recorded.
              </p>
              {feedback && (
                <p className="text-xs text-gray-400 mt-2 italic">
                  &ldquo;{feedback.slice(0, 100)}{feedback.length > 100 ? "…" : ""}&rdquo;
                </p>
              )}
              <p className="text-xs text-gray-400 mt-4">
                Need further help?{" "}
                <a href="mailto:support@wesupport.com.au" className="text-blue-600 hover:underline">support@wesupport.com.au</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CsatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <CsatForm />
    </Suspense>
  );
}
