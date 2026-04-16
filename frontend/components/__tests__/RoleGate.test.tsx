import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the AuthContext
const mockUser = { id: "1", email: "test@test.com", name: "Test", role: "agent" as const, theme: "light" as const, signature: null, image: null };

vi.mock("@/components/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    token: "fake-token",
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  })),
}));

import { RoleGate, useCanWrite } from "../RoleGate";
import { useAuth } from "@/components/AuthContext";

describe("RoleGate", () => {
  it("renders children when user role is allowed", () => {
    render(
      <RoleGate allowed={["admin", "agent"]}>
        <span>Allowed content</span>
      </RoleGate>
    );
    expect(screen.getByText("Allowed content")).toBeInTheDocument();
  });

  it("hides children when user role is not allowed", () => {
    render(
      <RoleGate allowed={["admin"]}>
        <span>Admin only</span>
      </RoleGate>
    );
    expect(screen.queryByText("Admin only")).not.toBeInTheDocument();
  });

  it("renders fallback when user role is not allowed", () => {
    render(
      <RoleGate allowed={["admin"]} fallback={<span>No access</span>}>
        <span>Admin only</span>
      </RoleGate>
    );
    expect(screen.queryByText("Admin only")).not.toBeInTheDocument();
    expect(screen.getByText("No access")).toBeInTheDocument();
  });

  it("hides children when no user is logged in", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: null,
      token: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    render(
      <RoleGate allowed={["agent"]}>
        <span>Guarded</span>
      </RoleGate>
    );
    expect(screen.queryByText("Guarded")).not.toBeInTheDocument();
  });
});

describe("useCanWrite", () => {
  function TestComponent() {
    const canWrite = useCanWrite();
    return <span>{canWrite ? "can write" : "read only"}</span>;
  }

  it("returns true for agents", () => {
    render(<TestComponent />);
    expect(screen.getByText("can write")).toBeInTheDocument();
  });

  it("returns false for viewers", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { ...mockUser, role: "viewer" },
      token: "fake-token",
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    render(<TestComponent />);
    expect(screen.getByText("read only")).toBeInTheDocument();
  });
});
