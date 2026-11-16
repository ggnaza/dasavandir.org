// A lesson's inline "PDF Document" files (viewed in-page, no download button).
// Stored in lessons.document_files (jsonb array, supabase/migrations/
// lesson_document_files.sql). lessons.document_url is kept equal to the FIRST
// file's url so older readers (AI context, backfill, previews) keep working.
//
// Not to be confused with lesson_files / "Attachments" — downloadable files.

export type LessonDocFile = { url: string; name: string };

export const MAX_LESSON_DOCUMENTS = 20;

/** The lesson's documents, falling back to the legacy single document_url. */
export function lessonDocumentFiles(lesson: {
  document_files?: unknown;
  document_url?: string | null;
}): LessonDocFile[] {
  const raw = Array.isArray(lesson.document_files) ? lesson.document_files : [];
  const files = raw
    .filter((f): f is { url: string; name?: unknown } => !!f && typeof (f as any).url === "string" && (f as any).url.length > 0)
    .map((f) => ({ url: f.url, name: typeof f.name === "string" && f.name.trim() ? f.name : fileNameFromUrl(f.url) }));
  if (files.length) return files;
  return lesson.document_url ? [{ url: lesson.document_url, name: fileNameFromUrl(lesson.document_url) }] : [];
}

/** Human file name from an upload URL (`<lessonId>/<timestamp>-<name>`). */
export function fileNameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return last.replace(/^\d{10,}-/, "") || "Document";
  } catch {
    return "Document";
  }
}

const MARKER = "/lesson-documents/";

/** Storage path inside the private `lesson-documents` bucket, or null if the url isn't one. */
export function lessonDocumentStoragePath(url: string): string | null {
  const i = url.indexOf(MARKER);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + MARKER.length).split("?")[0]);
}
