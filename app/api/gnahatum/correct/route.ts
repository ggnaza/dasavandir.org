import { getGnahatumUser, requireAuth } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { POINT_DISTRIBUTION } from "@/lib/gnahatum/constants";
import { recordCorrectionAsKnowledge } from "@/lib/gnahatum/learning";

interface CorrectionPayload {
  result_id: string;
  corrections: Array<{
    question_number: number;
    teacher_score: number;
    reason?: string;
  }>;
}

export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const body = (await request.json()) as CorrectionPayload;
  const { result_id, corrections } = body;

  if (!result_id || !corrections?.length) {
    return Response.json({ error: "result_id and corrections are required" }, { status: 400 });
  }

  const db = gnahatumDb();

  const { data: result, error: resultErr } = await db
    .from("results")
    .select("id, test_id, items, total_score, max_score")
    .eq("id", result_id)
    .single();

  if (resultErr || !result) {
    return Response.json({ error: "Result not found" }, { status: 404 });
  }

  const items = (result.items ?? []) as Array<{
    number: number;
    max_points: number;
    awarded_points: number;
    extracted_answer?: string;
    [key: string]: unknown;
  }>;

  const teacherItems = items.map((item) => {
    const correction = corrections.find((c) => c.question_number === item.number);
    if (correction) {
      const maxPts = POINT_DISTRIBUTION[item.number] ?? item.max_points;
      return {
        ...item,
        awarded_points: Math.min(Math.max(correction.teacher_score, 0), maxPts),
        teacher_corrected: true,
      };
    }
    return item;
  });

  const teacherTotal = teacherItems.reduce((sum, i) => sum + i.awarded_points, 0);

  const correctionRecords = corrections.map((c) => {
    const originalItem = items.find((i) => i.number === c.question_number);
    return {
      result_id,
      question_number: c.question_number,
      ai_score: originalItem?.awarded_points ?? 0,
      teacher_score: c.teacher_score,
      reason: c.reason ?? null,
      corrected_by: user!.id,
    };
  });

  const { error: insertErr } = await db.from("corrections").insert(correctionRecords);

  if (insertErr) {
    return Response.json({ error: "Failed to save corrections" }, { status: 500 });
  }

  const { error: updateErr } = await db
    .from("results")
    .update({
      teacher_total: teacherTotal,
      teacher_items: teacherItems,
      corrected_by: user!.id,
      corrected_at: new Date().toISOString(),
      reviewed: true,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", result_id);

  if (updateErr) {
    return Response.json({ error: "Failed to update result" }, { status: 500 });
  }

  // Turn the correction into knowledge the next scan can use, whatever model
  // scores it. This must never fail the correction itself — the teacher's
  // grade is the product; the learning is a by-product.
  let learned = 0;
  if (result.test_id) {
    learned = await recordCorrectionAsKnowledge({
      testId: result.test_id as string,
      correctedBy: user!.id,
      corrections: corrections.map((c) => ({
        question_number: c.question_number,
        teacher_score: c.teacher_score,
      })),
      items,
    });
  }

  return Response.json({
    teacherTotal,
    teacherItems,
    correctionsCount: corrections.length,
    variantsLearned: learned,
  });
}
