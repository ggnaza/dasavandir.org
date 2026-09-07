import { test, expect } from "@playwright/test";
import {
  MAX_SCAN_BYTES,
  SCAN_BUCKET,
  isAllowedScanType,
  isOwnedBy,
  scanObjectPath,
} from "../lib/ararka/storage";

/**
 * Scans are uploaded straight to Supabase Storage because Vercel rejects any
 * request body over 4.5MB with a 413 raised before the route handler runs.
 *
 * The scoring route is handed a client-supplied object key, so the ownership
 * check is the security boundary: without it any authenticated user could name
 * another user's object and have its contents scored and returned to them.
 */

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

test("an object path is namespaced by uploader then batch", () => {
  const path = scanObjectPath(ALICE, "batch-1", "application/pdf");
  const [uploader, batch, file] = path.split("/");

  expect(uploader).toBe(ALICE);
  expect(batch).toBe("batch-1");
  expect(file.endsWith(".pdf")).toBe(true);
});

test("the object name is generated, never taken from the upload", () => {
  const a = scanObjectPath(ALICE, "batch-1", "application/pdf");
  const b = scanObjectPath(ALICE, "batch-1", "application/pdf");
  expect(a).not.toBe(b);
});

test("extension follows the media type", () => {
  expect(scanObjectPath(ALICE, "b", "image/jpeg").endsWith(".jpg")).toBe(true);
  expect(scanObjectPath(ALICE, "b", "image/png").endsWith(".png")).toBe(true);
  expect(scanObjectPath(ALICE, "b", "image/webp").endsWith(".webp")).toBe(true);
});

test("an uploader owns their own path", () => {
  expect(isOwnedBy(scanObjectPath(ALICE, "b", "application/pdf"), ALICE)).toBe(true);
});

test("one uploader cannot claim another's object", () => {
  const bobs = scanObjectPath(BOB, "b", "application/pdf");
  expect(isOwnedBy(bobs, ALICE), "alice must not be able to score bob's scan").toBe(false);
});

test("a prefix that merely starts with the id is not ownership", () => {
  expect(
    isOwnedBy(`${ALICE}-evil/batch/x.pdf`, ALICE),
    "an id-prefixed sibling namespace must not pass the ownership check"
  ).toBe(false);
});

test("dot-dot segments are refused", () => {
  expect(isOwnedBy(`${ALICE}/../${BOB}/x.pdf`, ALICE)).toBe(false);
});

test("an empty uploader id never owns anything", () => {
  expect(isOwnedBy("/batch/x.pdf", "")).toBe(false);
});

test("only scan media types are accepted", () => {
  expect(isAllowedScanType("application/pdf")).toBe(true);
  expect(isAllowedScanType("image/png")).toBe(true);
  expect(isAllowedScanType("text/html")).toBe(false);
  expect(isAllowedScanType("application/x-msdownload")).toBe(false);
});

test("the scan ceiling matches what the scoring model accepts", () => {
  // Anthropic caps PDF documents at 32MB.
  expect(MAX_SCAN_BYTES).toBe(32 * 1024 * 1024);
  expect(SCAN_BUCKET).toBe("ararka-scans");
});
