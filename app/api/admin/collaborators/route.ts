import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "admin") return null;
  return user;
}

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Forbidden", { status: 403 });

  const { searchParams } = new URL(req.url);
  const course_id = searchParams.get("course_id");
  if (!course_id) return new Response("Missing course_id", { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_creator_access")
    .select("creator_id, created_at, profiles(full_name, email)")
    .eq("course_id", course_id)
    .order("created_at");

  if (error) return new Response("Failed to fetch", { status: 500 });

  return Response.json(
    (data ?? []).map((r: any) => ({
      creator_id: r.creator_id,
      full_name: r.profiles?.full_name ?? null,
      email: r.profiles?.email ?? null,
      created_at: r.created_at,
    }))
  );
}

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return new Response("Forbidden", { status: 403 });

  const { course_id, email } = await req.json();
  if (!course_id || !email) return new Response("Missing fields", { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (!profile) return new Response("No user found with that email.", { status: 404 });
  if (profile.role !== "course_creator") return new Response("User is not a course creator.", { status: 400 });

  const { error } = await admin.from("course_creator_access").insert({
    creator_id: profile.id,
    course_id,
    granted_by: user.id,
  });

  if (error) {
    if (error.code === "23505") return new Response("Already a collaborator.", { status: 409 });
    return new Response("Failed to add collaborator.", { status: 500 });
  }

  return new Response("OK");
}

export async function DELETE(req: Request) {
  const user = await requireAdmin();
  if (!user) return new Response("Forbidden", { status: 403 });

  const { creator_id, course_id } = z
    .object({ creator_id: z.string().uuid(), course_id: z.string().uuid() })
    .parse(await req.json());

  const admin = createAdminClient();
  const { error } = await admin
    .from("course_creator_access")
    .delete()
    .eq("creator_id", creator_id)
    .eq("course_id", course_id);

  if (error) return new Response("Failed to remove.", { status: 500 });
  return new Response("OK");
}
