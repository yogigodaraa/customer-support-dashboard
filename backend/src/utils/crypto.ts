import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return crypto.scryptSync(secret, "wesupport-integration-salt", 32);
}

export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encrypted: encrypted + ":" + authTag, iv: iv.toString("hex") };
}

export function decrypt(encrypted: string, iv: string): string {
  const [enc, authTag] = encrypted.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  let decrypted = decipher.update(enc, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function mask(value: string): string {
  if (value.length <= 7) return "****";
  return value.slice(0, 3) + "****" + value.slice(-4);
}
