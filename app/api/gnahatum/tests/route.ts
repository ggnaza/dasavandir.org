import { getGnahatumUser, requireAuth, requireLdm } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";
import { validateKeyForSave } from "@/lib/gnahatum/import";
import type { AnswerKeyItem } from "@/lib/gnahatum/constants";

const TEST_TYPES = ["diagnostic", "diagnostic_base", "diagnostic_target", "summative"];

interface SavePayload {
  subject_id?: string;
  grade?: number;
  test_type?: string;
  year?: string;
  answer_key?: AnswerKeyItem[];
  scoring_notes?: string | null;
  source_file_id?: string | null;
}

/**
 * Create or update one test and its answer key.
 *
 * The same validation the SQL generator applies runs here, so a key saved
 * through the UI is held to exactly the standard as one committed to a
 * migration file: 15 questions, the fixed point distribution, no blanks.
 */
export async function POST(request: Request) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const forbidden = requireLdm(user!);
  if (forbidden) return forbidden;

  let body: SavePayload;
  try {
    body = (await request.json()) as SavePayload;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { subject_id: subjectId, grade, test_type: testType, answer_key: answerKey } = body;
  const year = (body.year ?? "2025").trim();

  if (!subjectId || !grade || !testType || !Array.isArray(answerKey)) {
    return Response.json(
      { error: "subject_id, grade, test_type and answer_key are required" },
      { status: 400 },
    );
  }

  if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
    return Response.json({ error: "grade must be between 1 and 12" }, { status: 400 });
  }

  if (!TEST_TYPES.includes(testType)) {
    return Response.json(
      { error: `test_type must be one of: ${TEST_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  if (!year) {
    return Response.json({ error: "year is required" }, { status: 400 });
  }

  const errors = validateKeyForSave(answerKey);
  if (errors.length) {
    return Response.json({ error: "The answer key is not valid", details: errors }, { status: 400 });
  }

  const db = gnahatumDb();

  const { data: subject } = await db
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .maybeSingle();

  if (!subject) {
    return Response.json({ error: `Unknown subject: ${subjectId}` }, { status: 400 });
  }

  // Upsert on the natural key so re-importing a corrected document updates the
  // existing test rather than colliding with it. Scans and results reference
  // tests by id, so they survive the update.
  const { data: saved, error } = await db
    .from("tests")
    .upsert(
      {
        subject_id: subjectId,
        grade,
        test_type: testType,
        year,
        total_points: 15,
        answer_key: answerKey,
        scoring_notes: body.scoring_notes ?? null,
        source_file_id: body.source_file_id ?? null,
      },
      { onConflict: "subject_id,grade,test_type,year" },
    )
    .select("id")
    .single();

  if (error || !saved) {
    console.error("[gnahatum/tests] save failed", error?.message);
    return Response.json({ error: "Could not save the test" }, { status: 500 });
  }

  return Response.json({ id: saved.id, subject_id: subjectId, grade, test_type: testType, year });
}
