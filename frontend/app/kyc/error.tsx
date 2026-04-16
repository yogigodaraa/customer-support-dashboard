"use client";

import ErrorFallback from "@/components/ErrorFallback";

export default function KycError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="KYC failed to load"
      message="Could not connect to the KYC email service. Please check your connection and try again."
      error={error}
      reset={reset}
    />
  );
}
