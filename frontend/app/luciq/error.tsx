"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function LuciqError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Bug tracker failed to load"
      message="Could not connect to the Luciq bug tracker. Please check your connection and try again."
      error={error}
      reset={reset}
    />
  );
}
