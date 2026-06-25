import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  filename: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Path is server-controlled and scoped to the user's own folder — the
  // learner cannot upload into another user's submissions directory.
  const path = `submissions/${user.id}/${Date.now()}-${safeName}`;

  // Admin client bypasses storage RLS, so this works regardless of the
  // bucket's INSERT policies.
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("lesson-files")
    .createSignedUploadUrl(path, { upsert: true });

  if (error) {
    console.error("[submissions/upload-url]", error);
    return new Response(error.message, { status: 500 });
  }

  return Response.json({ signedUrl: data.signedUrl, path });
}
