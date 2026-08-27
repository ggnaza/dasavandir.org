import { getEfficacyUser, requireAuth, requireAdmin } from "@/lib/efficacy/auth";
import { efficacyDb } from "@/lib/efficacy/db";
import { z } from "zod";

export async function GET() {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireAdmin(user!);
  if (denied) return denied;

  const db = efficacyDb();
  const { data, error } = await db.from("chat_configs").select("*");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

const updateSchema = z.object({
  kind: z.enum(["plan", "delivery"]),
  instructions: z.string().max(10000),
});

export async function PUT(req: Request) {
  const user = await getEfficacyUser();
  const denied = requireAuth(user) ?? requireAdmin(user!);
  if (denied) return denied;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const db = efficacyDb();
  const { data, error } = await db
    .from("chat_configs")
    .update({ instructions: parsed.data.instructions })
    .eq("kind", parsed.data.kind)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
