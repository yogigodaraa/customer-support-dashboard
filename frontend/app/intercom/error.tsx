"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function IntercomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Intercom failed to load"
      message="Could not connect to Intercom. Please check your connection and try again."
      error={error}
      reset={reset}
    />
  );
}
