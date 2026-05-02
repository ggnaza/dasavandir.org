import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "admin") return null;
  return user;
}

const accessSchema = z.object({
  creator_id: z.string().uuid(),
  course_id: z.string().uuid(),
});

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (!user) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const creator_id = searchParams.get("creator_id");
  const admin = createAdminClient();
  const query = admin.from("course_creator_access").select("*, courses(id, title)");
  if (creator_id) query.eq("creator_id", creator_id);
  const { data, error } = await query;
  if (error) {
    console.error("[course-access/get]", error);
    return new Response("Failed to fetch access", { status: 500 });
  }
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return new Response("Forbidden", { status: 403 });

  const parsed = accessSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("course_creator_access").insert({
    creator_id: parsed.data.creator_id,
    course_id: parsed.data.course_id,
    granted_by: user.id,
  });
  if (error) {
    console.error("[course-access/post]", error);
    return new Response("Failed to grant access", { status: 500 });
  }
  return new Response("OK");
}

export async function DELETE(req: Request) {
  const user = await requireAdmin();
  if (!user) return new Response("Forbidden", { status: 403 });

  const parsed = accessSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("course_creator_access")
    .delete()
    .eq("creator_id", parsed.data.creator_id)
    .eq("course_id", parsed.data.course_id);
  if (error) {
    console.error("[course-access/delete]", error);
    return new Response("Failed to revoke access", { status: 500 });
  }
  return new Response("OK");
}
