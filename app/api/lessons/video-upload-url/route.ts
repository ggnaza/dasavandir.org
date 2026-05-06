import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

const schema = z.object({
  lessonId: z.string().uuid(),
  filename: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const { lessonId, filename } = parsed.data;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${lessonId}/${Date.now()}-${safeName}`;

  const { data, error } = await admin.storage
    .from("lesson-videos")
    .createSignedUploadUrl(path, { upsert: true });

  if (error) {
    console.error("[video-upload-url]", error);
    return new Response(error.message, { status: 500 });
  }

  return Response.json({ signedUrl: data.signedUrl, path });
}
