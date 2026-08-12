import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { z } from "zod";

// GET /api/admin/courses/[id]/phases — list this course's phases, ordered.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_phases")
    .select("id, name, ord")
    .eq("course_id", params.id)
    .order("ord");

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data ?? []);
}

// POST /api/admin/courses/[id]/phases — create a phase (e.g. "TLA", "Regional
// Orientation"). ord is assigned server-side as max(ord)+1 to satisfy the
// UNIQUE (course_id, ord) constraint. See ADR-0003.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ownerErr = await assertCourseOwner(params.id, user.id);
  if (ownerErr) return ownerErr;

  const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("course_phases")
    .select("ord")
    .eq("course_id", params.id)
    .order("ord", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrd = (last?.ord ?? 0) + 1;

  const { data, error } = await admin
    .from("course_phases")
    .insert({ course_id: params.id, name: parsed.data.name.trim(), ord: nextOrd })
    .select("id, name, ord")
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}
