import { loginSchema, registerSchema } from "../../schemas/auth.js";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration with all fields", () => {
    const result = registerSchema.safeParse({
      email: "new@example.com",
      password: "password123",
      name: "Test User",
      role: "agent",
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to agent when omitted", () => {
    const result = registerSchema.safeParse({
      email: "new@example.com",
      password: "password123",
      name: "Test User",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("agent");
    }
  });

  it("rejects password shorter than 6 characters", () => {
    const result = registerSchema.safeParse({
      email: "new@example.com",
      password: "12345",
      name: "Test User",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = registerSchema.safeParse({
      email: "new@example.com",
      password: "password123",
      name: "Test User",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });
});
