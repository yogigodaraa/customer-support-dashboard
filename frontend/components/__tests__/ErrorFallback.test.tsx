import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorFallback from "../ErrorFallback";

describe("ErrorFallback", () => {
  it("renders default title and message", () => {
    render(<ErrorFallback />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
  });

  it("renders custom title and message", () => {
    render(
      <ErrorFallback
        title="Gmail failed to load"
        message="Could not connect to Gmail."
      />
    );
    expect(screen.getByText("Gmail failed to load")).toBeInTheDocument();
    expect(screen.getByText("Could not connect to Gmail.")).toBeInTheDocument();
  });

  it("displays error digest when provided", () => {
    const error = Object.assign(new Error("test"), { digest: "abc123" });
    render(<ErrorFallback error={error} />);
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("renders retry button when reset is provided", () => {
    const reset = vi.fn();
    render(<ErrorFallback reset={reset} />);
    const btn = screen.getByRole("button", { name: /try again/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("does not render retry button when no reset is provided", () => {
    render(<ErrorFallback />);
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});
