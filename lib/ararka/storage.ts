/**
 * Scan storage for Ararka.
 *
 * Scans are uploaded from the browser straight to Supabase Storage using a
 * short-lived signed URL, then the scoring route downloads them server-side.
 * The file never passes through a Vercel Function, which is the whole point:
 * Vercel rejects any request body over 4.5MB with 413 before the handler runs,
 * and a scanned multi-page test is routinely larger than that.
 *
 * The bucket is private; nothing is readable without the service role or a
 * signed URL.
 */

export const SCAN_BUCKET = "ararka-scans";

/**
 * Anthropic caps PDF documents at 32MB and 100 pages, so there is no point
 * accepting more than the scorer can use. The bucket enforces this too.
 */
export const MAX_SCAN_BYTES = 32 * 1024 * 1024;

export const ALLOWED_SCAN_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ScanMediaType = (typeof ALLOWED_SCAN_TYPES)[number];

export function isAllowedScanType(value: string): value is ScanMediaType {
  return (ALLOWED_SCAN_TYPES as readonly string[]).includes(value);
}

const EXTENSION_BY_TYPE: Record<ScanMediaType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Build the object key for one scan.
 *
 * Namespaced by uploader then batch so a batch is easy to find or purge, and
 * so one uploader's objects can never collide with another's. The filename is
 * a fresh UUID rather than anything user-supplied — an uploaded name is
 * attacker-controlled and has no business shaping a storage path.
 */
export function scanObjectPath(
  uploaderId: string,
  batchId: string,
  mediaType: ScanMediaType,
): string {
  return `${uploaderId}/${batchId}/${crypto.randomUUID()}.${EXTENSION_BY_TYPE[mediaType]}`;
}

/**
 * Whether `path` belongs to `uploaderId`.
 *
 * The scoring route is handed a client-supplied path, so it must confirm the
 * caller owns it before downloading — otherwise any authenticated user could
 * name another user's object and have it scored (and its contents echoed back
 * through the scoring result).
 */
export function isOwnedBy(path: string, uploaderId: string): boolean {
  if (!uploaderId) return false;
  // Storage keys are literal strings, not filesystem paths, so ".." is not
  // traversal here — but refuse it anyway rather than reason about how every
  // future consumer might join it.
  if (path.split("/").includes("..")) return false;
  // The trailing slash matters: without it "alice-evil/x.pdf" would pass an
  // ownership check for "alice".
  return path.startsWith(`${uploaderId}/`);
}
