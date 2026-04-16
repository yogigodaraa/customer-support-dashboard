import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-for-testing-only";

export function generateTestToken(overrides: Partial<{ userId: string; email: string; role: string }> = {}) {
  const payload = {
    userId: overrides.userId || "test-user-id",
    email: overrides.email || "test@example.com",
    role: overrides.role || "agent",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}
