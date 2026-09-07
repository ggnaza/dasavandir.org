import { getArarkaUser, requireAuth } from "@/lib/ararka/auth";
import { ararkaDb } from "@/lib/ararka/db";
import { scoreFromScan } from "@/lib/ararka/scorer";
import type { AnswerKeyItem } from "@/lib/ararka/constants";

export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getArarkaUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const testId = formData.get("test_id") as string | null;
  const studentName = (formData.get("student_name") as string | null) ?? null;
  const batchId = (formData.get("batch_id") as string | null) ?? null;
  const modelId = (formData.get("model_id") as string | null) ?? undefined;
  const onBehalfOf = (formData.get("on_behalf_of") as string | null) ?? null;

  if (!file || !testId) {
    return Response.json({ error: "file and test_id are required" }, { status: 400 });
  }

  if (file.size > 25 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 25MB)" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const db = ararkaDb();

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buffer.toString("base64");
  const mediaType = file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

  const teacherId = onBehalfOf ?? user!.id;
  const scanInsert: Record<string, unknown> = {
    test_id: testId,
    student_name: studentName,
    teacher_id: teacherId,
    file_path: `scans/${testId}/${Date.now()}_${file.name}`,
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
    return Response.json({ error: "Failed to create scan record" }, { status: 500 });
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
