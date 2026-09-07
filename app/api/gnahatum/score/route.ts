import { getGnahatumUser, requireAuth } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreFromScan } from "@/lib/gnahatum/scorer";
import type { AnswerKeyItem } from "@/lib/gnahatum/constants";
import {
  SCAN_BUCKET,
  MAX_SCAN_BYTES,
  isAllowedScanType,
  isOwnedBy,
} from "@/lib/gnahatum/storage";

export const maxDuration = 120;

interface ScoreRequest {
  test_id?: string;
  storage_path?: string;
  student_name?: string | null;
  batch_id?: string | null;
  model_id?: string;
  on_behalf_of?: string | null;
}

/**
 * Score one scan that the browser has already uploaded to Supabase Storage.
 *
 * The file is fetched server-side rather than posted here: Vercel rejects any
 * request body over 4.5MB with a 413 raised before this handler runs, and a
 * scanned test is routinely bigger than that. The client uploads via a signed
 * URL (see /api/gnahatum/upload-url) and sends only the object key.
 */
export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  let body: ScoreRequest;
  try {
    body = (await request.json()) as ScoreRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { test_id: testId, storage_path: storagePath } = body;
  const studentName = body.student_name ?? null;
  const batchId = body.batch_id ?? null;
  const modelId = body.model_id ?? undefined;
  const onBehalfOf = body.on_behalf_of ?? null;

  if (!testId || !storagePath) {
    return Response.json(
      { error: "test_id and storage_path are required" },
      { status: 400 },
    );
  }

  // The path arrives from the client, so ownership must be re-checked here.
  // Without this, any authenticated user could name another user's object and
  // have its contents scored and returned to them.
  if (!isOwnedBy(storagePath, user!.id)) {
    return Response.json({ error: "Not your upload" }, { status: 403 });
  }

  const db = gnahatumDb();

  const { data: test, error: testErr } = await db
    .from("tests")
    .select("id, answer_key, scoring_notes, total_points")
    .eq("id", testId)
    .single();

  if (testErr || !test) {
    return Response.json({ error: "Test not found" }, { status: 404 });
  }

  if (!test.answer_key || !Array.isArray(test.answer_key) || test.answer_key.length === 0) {
    return Response.json({ error: "No answer key configured for this test" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: fileBlob, error: downloadErr } = await admin.storage
    .from(SCAN_BUCKET)
    .download(storagePath);

  if (downloadErr || !fileBlob) {
    return Response.json(
      { error: `Could not read the uploaded scan: ${downloadErr?.message ?? "not found"}` },
      { status: 404 },
    );
  }

  if (fileBlob.size > MAX_SCAN_BYTES) {
    return Response.json(
      { error: "Scan is too large to score (max 32MB)" },
      { status: 413 },
    );
  }

  const mediaType = fileBlob.type;
  if (!isAllowedScanType(mediaType)) {
    return Response.json({ error: `Unsupported file type: ${mediaType}` }, { status: 400 });
  }

  const imageBase64 = Buffer.from(await fileBlob.arrayBuffer()).toString("base64");

  const teacherId = onBehalfOf ?? user!.id;
  const scanInsert: Record<string, unknown> = {
    test_id: testId,
    student_name: studentName,
    teacher_id: teacherId,
    file_path: storagePath,
    file_url: "",
    status: "processing",
  };
  if (batchId) scanInsert.batch_id = batchId;
  if (onBehalfOf) scanInsert.uploaded_by = user!.id;

  const { data: scan, error: scanErr } = await db
    .from("scans")
    .insert(scanInsert)
    .select("id")
    .single();

  if (scanErr || !scan) {
    console.error("[gnahatum/score] scan insert failed", scanErr?.message);
    return Response.json(
      { error: `Failed to create scan record: ${scanErr?.message ?? "unknown error"}` },
      { status: 500 },
    );
  }

  try {
    const scoringResult = await scoreFromScan(
      imageBase64,
      mediaType,
      test.answer_key as AnswerKeyItem[],
      test.scoring_notes,
      modelId,
    );

    const finalStudentName = studentName ?? scoringResult.studentName;

    if (finalStudentName || scoringResult.teacherName) {
      const scanUpdate: Record<string, unknown> = {};
      if (finalStudentName && !studentName) scanUpdate.student_name = finalStudentName;
      if (scoringResult.teacherName) scanUpdate.teacher_name = scoringResult.teacherName;
      if (Object.keys(scanUpdate).length > 0) {
        await db.from("scans").update(scanUpdate).eq("id", scan.id);
      }
    }

    const { data: result, error: resultErr } = await db
      .from("results")
      .insert({
        scan_id: scan.id,
        test_id: testId,
        total_score: scoringResult.totalScore,
        max_score: test.total_points ?? 15,
        items: scoringResult.items,
        ai_raw: scoringResult.raw,
        reviewed: false,
      })
      .select("id")
      .single();

    if (resultErr || !result) {
      await db.from("scans").update({ status: "error" }).eq("id", scan.id);
      return Response.json({ error: "Failed to save results" }, { status: 500 });
    }

    await db.from("scans").update({ status: "scored" }).eq("id", scan.id);

    return Response.json({
      resultId: result.id,
      scanId: scan.id,
      totalScore: scoringResult.totalScore,
      maxScore: test.total_points ?? 15,
      items: scoringResult.items,
      studentName: finalStudentName,
      teacherName: scoringResult.teacherName,
    });
  } catch (err) {
    await db.from("scans").update({ status: "error" }).eq("id", scan.id);
    const message = err instanceof Error ? err.message : "Scoring failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
