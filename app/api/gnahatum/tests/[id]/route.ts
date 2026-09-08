import { getGnahatumUser, requireAuth, requireLdm } from "@/lib/gnahatum/auth";
import { gnahatumDb } from "@/lib/gnahatum/db";

/**
 * Fetch one test's full answer key.
 *
 * The manage page lists every test without its key — a subject's keys together
 * run to hundreds of kilobytes — and pulls the one being edited on demand.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await getGnahatumUser();
  const denied = requireAuth(user);
  if (denied) return denied;

  const forbidden = requireLdm(user!);
  if (forbidden) return forbidden;

  const db = gnahatumDb();

  const { data: test, error } = await db
    .from("tests")
    .select("id, subject_id, grade, test_type, year, answer_key, scoring_notes, source_file_id")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    console.error("[gnahatum/tests/:id] load failed", error.message);
    return Response.json({ error: "Could not load that test" }, { status: 500 });
  }

  if (!test) return Response.json({ error: "Test not found" }, { status: 404 });

  return Response.json(test);
}
