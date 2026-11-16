// Run: node --test lib/email-batch.test.ts   (Node >= 22.18 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { sendInBatches, type BatchEmail } from "./email-batch.ts";

const mk = (n: number): BatchEmail[] =>
  Array.from({ length: n }, (_, i) => ({ from: "f", to: `u${i}@x.org`, subject: "s", html: "h" }));

test("48 invites go out as ONE request, not 48 parallel ones", async () => {
  const calls: number[] = [];
  const r = await sendInBatches(mk(48), async (c) => { calls.push(c.length); return { data: {}, error: null }; });
  assert.deepEqual(calls, [48]);
  assert.deepEqual(r, { sent: 48, failed: [] });
});

test("chunks above 100 and sends sequentially", async () => {
  let inFlight = 0, maxInFlight = 0; const sizes: number[] = [];
  await sendInBatches(mk(250), async (c) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--; sizes.push(c.length); return { data: {}, error: null };
  });
  assert.deepEqual(sizes, [100, 100, 50]);
  assert.equal(maxInFlight, 1);
});

test("an SDK {error} (not a throw) is reported, after one retry", async () => {
  let n = 0;
  const r = await sendInBatches(mk(3), async () => { n++; return { data: null, error: { message: "rate_limit_exceeded" } }; }, { retryDelayMs: 1 });
  assert.equal(n, 2);
  assert.equal(r.sent, 0);
  assert.deepEqual(r.failed.map((f) => f.reason), ["rate_limit_exceeded", "rate_limit_exceeded", "rate_limit_exceeded"]);
});

test("a transient failure succeeds on retry", async () => {
  let n = 0;
  const r = await sendInBatches(mk(2), async () => (++n === 1 ? { data: null, error: { message: "429" } } : { data: {}, error: null }), { retryDelayMs: 1 });
  assert.deepEqual(r, { sent: 2, failed: [] });
});

test("a thrown error is caught, never propagates", async () => {
  const r = await sendInBatches(mk(1), async () => { throw new Error("network"); }, { retryDelayMs: 1 });
  assert.deepEqual(r.failed, [{ to: "u0@x.org", reason: "network" }]);
});
