import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) return new Response("Missing path", { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("lesson-files")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    return new Response("Failed to generate URL", { status: 500 });
  }

  return Response.json({ url: data.signedUrl });
}
