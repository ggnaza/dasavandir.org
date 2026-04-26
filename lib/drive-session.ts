import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function getKey(): Buffer {
  const secret = process.env.DRIVE_SESSION_SECRET;
  if (!secret) throw new Error("DRIVE_SESSION_SECRET env var is not set");
  return createHash("sha256").update(secret).digest();
}

function encryptTokens(tokens: object): { iv: string; ciphertext: string; authTag: string } {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
  };
}

function decryptTokens(iv: string, ciphertext: string, authTag: string): object {
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

// Saves tokens encrypted in DB. Returns the session ID to store in a cookie.
export async function saveDriveSession(userId: string, tokens: object): Promise<string> {
  const admin = createAdminClient();
  const { iv, ciphertext, authTag } = encryptTokens(tokens);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const { data, error } = await admin
    .from("drive_sessions")
    .insert({
      user_id: userId,
      tokens_json: ciphertext,
      iv,
      auth_tag: authTag,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save drive session: ${error.message}`);
  return data.id;
}

// Returns decrypted tokens or null if session is missing/expired.
export async function getDriveTokens(sessionId: string, userId: string): Promise<object | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("drive_sessions")
    .select("tokens_json, iv, auth_tag, expires_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  try {
    return decryptTokens(data.iv, data.tokens_json, data.auth_tag);
  } catch {
    return null;
  }
}

export async function deleteDriveSession(sessionId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("drive_sessions").delete().eq("id", sessionId);
}
