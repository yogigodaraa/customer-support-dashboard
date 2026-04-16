import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { totp as totpUtil } from "@otplib/preset-default";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

const APP_NAME = "WeSupport";

function makeSecret(): string {
  // Generate a 20-byte secret and base32-encode it (RFC 4648, no padding)
  const bytes = crypto.randomBytes(20);
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) result += CHARS[(value << (5 - bits)) & 31];
  return result;
}

// POST /api/auth/2fa/setup — generate TOTP secret, store unconfirmed
router.post("/setup", async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.twoFactorEnabled) { res.status(400).json({ error: "2FA is already enabled" }); return; }

  const secret = makeSecret();
  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

  const otpauth = totpUtil.keyuri(user.email, APP_NAME, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  res.json({ secret, qrDataUrl, otpauth });
});

// POST /api/auth/2fa/verify — verify token and enable 2FA
router.post("/verify", async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId as string;
  const { token } = req.body as { token: string };
  if (!token) { res.status(400).json({ error: "token required" }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) { res.status(400).json({ error: "Run setup first" }); return; }

  const valid = totpUtil.verify({ token, secret: user.twoFactorSecret });
  if (!valid) { res.status(400).json({ error: "Invalid TOTP token" }); return; }

  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  res.json({ ok: true, message: "2FA enabled" });
});

// POST /api/auth/2fa/disable — verify password then disable
router.post("/disable", async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId as string;
  const { password } = req.body as { password: string };
  if (!password) { res.status(400).json({ error: "password required" }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Incorrect password" }); return; }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  res.json({ ok: true, message: "2FA disabled" });
});

export default router;
