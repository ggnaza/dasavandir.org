import { getEfficacyUser, requireAuth, requireAdmin } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { z } from "zod";

const createSchema = z.object({
  ldmId: z.string().uuid(),
  teacherId: z.string().uuid(),
  school: z.string().max(300).optional(),
  region: z.string().max(300).optional(),
});

export async function GET() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireAdmin(user!);
  if (denied) return denied;

  const db = efficacyDb();
  const { data, error } = await db
    .from("ldm_teacher_assignments")
    .select("*, ldm:ldm_id(id, full_name, email), teacher:teacher_id(id, full_name, email)")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireAdmin(user!);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const db = efficacyDb();
  const { data, error } = await db
    .from("ldm_teacher_assignments")
    .upsert(
      {
        ldm_id: parsed.data.ldmId,
        teacher_id: parsed.data.teacherId,
        school: parsed.data.school ?? null,
        region: parsed.data.region ?? null,
      },
      { onConflict: "ldm_id,teacher_id" },
    )
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireAdmin(user!);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const db = efficacyDb();
  const { error } = await db.from("ldm_teacher_assignments").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
