"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function GmailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Gmail failed to load"
      message="Could not connect to the Gmail service. Please check your connection and try again."
      error={error}
      reset={reset}
    />
  );
}
