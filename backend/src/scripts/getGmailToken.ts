/**
 * One-time script to obtain Gmail OAuth2 refresh tokens.
 *
 * Usage:
 *   npx tsx src/scripts/getGmailToken.ts
 *
 * 1. Opens a browser URL for Google consent.
 * 2. After you sign in and authorize, Google redirects to the callback URL.
 * 3. The backend callback route exchanges the code for tokens and prints the refresh token.
 * 4. Copy the refresh token into .env as GMAIL_KYC_REFRESH_TOKEN or GMAIL_SUPPORT_REFRESH_TOKEN.
 * 5. Run this script once per Gmail account.
 */

import "dotenv/config";
import { google } from "googleapis";

const clientId = process.env.GOOGLE_CLIENT_ID!;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

if (!clientId || !clientSecret || !redirectUri) {
  console.error("Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI in .env");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\n=== Gmail OAuth2 Token Helper ===\n");
console.log("Open this URL in your browser and sign in with the Gmail account:\n");
console.log(authUrl);
console.log("\nAfter authorizing, the server at /auth/google/callback will show the refresh token.");
console.log("Copy it into your .env file.\n");
console.log("Waiting for callback... (start the backend server if not running)\n");
