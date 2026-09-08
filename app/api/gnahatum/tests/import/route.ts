import { cookies } from "next/headers";
import { google } from "googleapis";
import mammoth from "mammoth";
import { getGnahatumUser, requireAuth, requireLdm } from "@/lib/gnahatum/auth";
import { getOAuthClient } from "@/lib/google-drive";
import { getDriveTokens } from "@/lib/drive-session";
import { callLLM, getAIModel } from "@/lib/llm";
import {
  EXTRACTION_SYSTEM_PROMPT,
  driveFileIdFromUrl,
  normaliseImportedKey,
  parseModelJson,
} from "@/lib/gnahatum/import";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Enough to carry a whole test document; beyond this the tail is the FAQ boilerplate. */
const MAX_DOCUMENT_CHARS = 120_000;

/**
 * Read one test document and pull its answer key out, without writing anything.
 *
 * Accepts either a pasted Google Docs / Drive link (read through the existing
 * Drive connection) or the document text pasted straight in. The text path
 * needs no OAuth at all, which is the reliable fallback when a document lives
 * outside the connected account.
 */
export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  // An imported key becomes the grading standard for a whole test, so this is
  // not a rank-and-file teacher action.
  const forbidden = requireLdm(user!);
  if (forbidden) return forbidden;

  let body: { doc_url?: string; text?: string };
  try {
    body = (await request.json()) as { doc_url?: string; text?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let documentText = (body.text ?? "").trim();
  let sourceFileId: string | null = null;

  if (!documentText && body.doc_url) {
    const fileId = driveFileIdFromUrl(body.doc_url);
    if (!fileId) {
      return Response.json(
        { error: "That does not look like a Google Docs or Drive link" },
        { status: 400 },
      );
    }
    sourceFileId = fileId;

    const sessionId = cookies().get("drive_session")?.value;
    const token = sessionId ? await getDriveTokens(sessionId, user!.id) : null;
    if (!token) {
      return Response.json(
        { error: "Google Drive is not connected. Connect it, or paste the document text instead.", needs_drive: true },
        { status: 401 },
      );
    }

    try {
      documentText = await readDriveDocument(fileId, token);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Could not read that document" },
        { status: 400 },
      );
    }
  }

  if (!documentText) {
    return Response.json(
      { error: "Provide a Google Docs link or paste the document text" },
      { status: 400 },
    );
  }

  if (documentText.length > MAX_DOCUMENT_CHARS) {
    documentText = documentText.slice(0, MAX_DOCUMENT_CHARS);
  }

  let raw: unknown;
  try {
    const model = await getAIModel();
    const response = await callLLM(model, EXTRACTION_SYSTEM_PROMPT, documentText, {
      maxTokens: 8000,
      // Transcription, not composition — near-zero temperature keeps it from
      // paraphrasing the official wording.
      temperature: 0,
      jsonMode: true,
    });
    raw = parseModelJson(response);
  } catch (err) {
    console.error("[gnahatum/tests/import] extraction failed", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not extract the answer key" },
      { status: 502 },
    );
  }

  try {
    const imported = normaliseImportedKey(raw);
    return Response.json({ ...imported, source_file_id: sourceFileId });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "The extraction was not usable" },
      { status: 502 },
    );
  }
}

/**
 * Fetch a document's text from Drive.
 *
 * Google Docs export directly. A .docx is a binary upload that Drive will not
 * export, so it is downloaded and converted locally with mammoth — the whole
 * Gnahatum test set is a mix of both formats.
 */
async function readDriveDocument(fileId: string, token: object): Promise<string> {
  const auth = getOAuthClient();
  auth.setCredentials(token);
  const drive = google.drive({ version: "v3", auth });

  const { data: meta } = await drive.files.get({ fileId, fields: "name, mimeType" });
  const mimeType = meta.mimeType ?? "";

  if (mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
    return String(res.data);
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    const buffer = Buffer.from(res.data as ArrayBuffer);
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (mimeType === "text/plain") {
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    return String(res.data);
  }

  throw new Error(
    `"${meta.name ?? fileId}" is a ${mimeType || "unknown"} file. Open it and paste the text instead.`,
  );
}
