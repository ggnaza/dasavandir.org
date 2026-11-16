// Run: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonDocumentFiles, fileNameFromUrl, lessonDocumentStoragePath } from "./lesson-documents.ts";

const U = "https://abc.supabase.co/storage/v1/object/public/lesson-documents/L1/1731840000000-Week_1_Reading.pdf";

test("falls back to legacy document_url when document_files is empty", () => {
  assert.deepEqual(lessonDocumentFiles({ document_files: [], document_url: U }), [{ url: U, name: "Week_1_Reading.pdf" }]);
  assert.deepEqual(lessonDocumentFiles({ document_url: null }), []);
});

test("document_files wins and drops malformed entries", () => {
  const files = lessonDocumentFiles({
    document_url: U,
    document_files: [{ url: "https://x/a.pdf", name: "A" }, { name: "no url" }, null, { url: "https://x/b.pdf" }],
  });
  assert.deepEqual(files, [{ url: "https://x/a.pdf", name: "A" }, { url: "https://x/b.pdf", name: "b.pdf" }]);
});

test("storage path extraction", () => {
  assert.equal(lessonDocumentStoragePath(U), "L1/1731840000000-Week_1_Reading.pdf");
  assert.equal(lessonDocumentStoragePath("https://drive.google.com/file/d/x"), null);
  assert.equal(fileNameFromUrl("not a url"), "Document");
});
