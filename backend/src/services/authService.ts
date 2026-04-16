import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  theme: string;
  signature: string | null;
}

export interface AuthResult {
  token: string;
  user: SafeUser;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  pendingToken: string;
}

function toSafeUser(u: { id: string; email: string; name: string | null; role: string; theme: string; signature: string | null }): SafeUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, theme: u.theme, signature: u.signature };
}

class AuthService {
  async register(email: string, password: string, name: string, role?: string): Promise<AuthResult> {
    if (!email || !password || password.length < 6) {
      throw new Error("Email and password (min 6 chars) are required");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("Email already in use");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: role || "agent" },
    });

    const token = this.signToken(user.id, user.email, user.role);
    logger.info(`User registered: ${email} (${user.role})`);
    return { token, user: toSafeUser(user) };
  }

  async login(email: string, password: string, ip?: string, userAgent?: string): Promise<AuthResult | TwoFactorChallenge> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new Error("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    // If 2FA is enabled, issue a short-lived pending token instead of a full JWT
    if (user.twoFactorEnabled) {
      const pendingToken = jwt.sign(
        { userId: user.id, pending2fa: true },
        JWT_SECRET,
        { expiresIn: "5m" }
      );
      return { twoFactorRequired: true, pendingToken };
    }

    const token = this.signToken(user.id, user.email, user.role);

    // Track session
    await prisma.userSession.create({
      data: { userId: user.id, ip: ip ?? null, userAgent: userAgent ?? null },
    }).catch(() => {});

    logger.info(`User logged in: ${email}`);
    return { token, user: toSafeUser(user) };
  }

  async completeTwoFactor(pendingToken: string, code: string, ip?: string, userAgent?: string): Promise<AuthResult> {
    let payload: { userId: string; pending2fa: boolean };
    try {
      payload = jwt.verify(pendingToken, JWT_SECRET) as typeof payload;
    } catch {
      throw new Error("Invalid or expired session. Please log in again.");
    }
    if (!payload.pending2fa) throw new Error("Invalid token type");

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.twoFactorSecret) throw new Error("2FA not configured");

    const { totp } = await import("@otplib/preset-default");
    const valid = totp.verify({ token: code, secret: user.twoFactorSecret });
    if (!valid) throw new Error("Invalid authenticator code");

    const token = this.signToken(user.id, user.email, user.role);

    await prisma.userSession.create({
      data: { userId: user.id, ip: ip ?? null, userAgent: userAgent ?? null },
    }).catch(() => {});

    logger.info(`User completed 2FA login: ${user.email}`);
    return { token, user: toSafeUser(user) };
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  }

  async getUserById(userId: string): Promise<SafeUser | null> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user ? toSafeUser(user) : null;
  }

  private signToken(userId: string, email: string, role: string): string {
    return jwt.sign({ userId, email, role } as JwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }
}

export default new AuthService();
