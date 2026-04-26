import { google } from "googleapis";

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `https://dasavandir-org-h82a.vercel.app/api/drive/callback`;

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.readonly"],
    prompt: "consent",
    redirect_uri: REDIRECT_URI,
  });
}

export function tokenFromCookie(raw: string | undefined) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
