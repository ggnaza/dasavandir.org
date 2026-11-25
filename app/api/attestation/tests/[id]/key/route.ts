import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { denyUnlessManager, getAttestationUser, jsonError, loadTest, readJson, zodMessage } from "@/lib/attestation/server";
import { coerceCorrect } from "@/lib/attestation/schemas";
import { normalizeKeyCell, parseKeyText, sameCorrect, validateCorrect } from "@/lib/attestation-core";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Step 1 of the key import: read the key and PROPOSE answers. Nothing is saved.
 *
 * Accepts the key PDF (multipart field `file`) or pasted text (`text`). The text
 * layer is parsed mechanically — no AI — because AI-read keys were wrong 8 times in
 * the audit while the text layer was exact (ADR-0010). Questions the parser cannot
 * place come back with no proposal, for the admin to enter by hand.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const data = await loadTest(params.id);
  if (!data) return jsonError("Test not found", 404);

  let text = "";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const pasted = form.get("text");
    if (file instanceof File && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) return jsonError("Max 10MB", 400);
      if (file.type !== "application/pdf") return jsonError("Upload the answer key as a PDF", 400);
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- same loader as the other PDF routes (avoids pdf-parse's test-file import)
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      try {
        const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()));
        text = String(parsed.text ?? "");
      } catch {
        return jsonError("Could not read text from this PDF. Paste the key as text instead.", 422);
      }
    } else if (typeof pasted === "string") {
      text = pasted;
    }
  } else {
    const parsed = await readJson(req);
    if ("error" in parsed) return parsed.error;
    const body = z.object({ text: z.string().max(200000) }).safeParse(parsed.body);
    if (!body.success) return jsonError(zodMessage(body.error), 400);
    text = body.data.text;
  }
  if (!text.trim()) return jsonError("The key is empty", 400);

  const expected = data.questions.map((q) => q.number);
  const parsedKey = parseKeyText(text, expected);

  const proposals = data.questions.map((q) => {
    const raw = parsedKey.raw[q.number];
    if (raw === undefined) {
      return { id: q.id, number: q.number, answer_type: q.answer_type, raw: null, proposed: null, current: q.correct, changed: false, warnings: ["Not found in the key — enter it by hand"], errors: [] as string[] };
    }
    const norm = normalizeKeyCell(raw, q);
    const errors = norm.correct === null ? [] : validateCorrect({ ...q, correct: norm.correct });
    return {
      id: q.id,
      number: q.number,
      answer_type: q.answer_type,
      raw,
      proposed: norm.correct,
      current: q.correct,
      changed: !sameCorrect(norm.correct, q.correct),
      warnings: norm.warnings,
      errors,
    };
  });

  return Response.json({
    strategy: parsedKey.strategy,
    found: Object.keys(parsedKey.raw).length,
    expected: expected.length,
    missing: parsedKey.missing,
    parserWarnings: parsedKey.warnings.slice(0, 50),
    proposals,
  });
}

const applySchema = z.object({
  updates: z.array(z.object({ id: z.string().uuid(), correct: z.unknown() })).min(1).max(500),
});

/** Step 2: save the answers the admin accepted. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getAttestationUser();
  const denied = denyUnlessManager(user);
  if (denied) return denied;

  const parsed = await readJson(req);
  if ("error" in parsed) return parsed.error;
  const input = applySchema.safeParse(parsed.body);
  if (!input.success) return jsonError(zodMessage(input.error), 400);

  const data = await loadTest(params.id);
  if (!data) return jsonError("Test not found", 404);
  const byId = new Map(data.questions.map((q) => [q.id, q]));

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let saved = 0;
  for (const u of input.data.updates) {
    const q = byId.get(u.id);
    if (!q) return jsonError(`Question ${u.id} is not in this test`, 400);
    let correct;
    try {
      correct = coerceCorrect(q.answer_type, u.correct);
    } catch (e) {
      return jsonError(`Q${q.number}: ${zodMessage(e)}`, 400);
    }
    if (data.test.status === "published") {
      const problems = validateCorrect({ ...q, correct });
      if (problems.length) return jsonError(`Published test, Q${q.number}: ${problems.join("; ")}`, 409);
    }
    const { error } = await admin.from("attestation_questions").update({ correct, updated_at: now }).eq("id", q.id);
    if (error) return jsonError(error.message, 500);
    saved++;
  }
  return Response.json({ saved });
}
