// Pure batching logic for bulk email sends. No imports, so it can be unit
// tested with `node --test` (see lib/email-batch.test.ts).

export type BatchEmail = { from: string; to: string; subject: string; html: string };

type SendResult = { data: unknown; error: { message?: string } | null };
export type BatchSender = (chunk: BatchEmail[]) => Promise<SendResult>;

export type BatchResult = { sent: number; failed: { to: string; reason: string }[] };

/** Resend accepts at most 100 emails per batch call. */
export const RESEND_BATCH_MAX = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send `emails` in chunks of `chunkSize`, one request at a time, retrying a
 * chunk once after a short pause if it fails (e.g. a 429 rate-limit). Never
 * throws: every recipient ends up counted in `sent` or listed in `failed`.
 */
export async function sendInBatches(
  emails: BatchEmail[],
  send: BatchSender,
  { chunkSize = RESEND_BATCH_MAX, retryDelayMs = 1000 }: { chunkSize?: number; retryDelayMs?: number } = {},
): Promise<BatchResult> {
  const result: BatchResult = { sent: 0, failed: [] };
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    let reason = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(retryDelayMs);
      try {
        const { error } = await send(chunk);
        if (!error) { reason = ""; break; }
        reason = error.message || "send failed";
      } catch (e) {
        reason = e instanceof Error ? e.message : String(e);
      }
    }
    if (reason) result.failed.push(...chunk.map((e) => ({ to: e.to, reason })));
    else result.sent += chunk.length;
  }
  return result;
}
