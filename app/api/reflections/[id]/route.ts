import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("reflections")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return new Response("Failed to delete", { status: 500 });
  return new Response(null, { status: 204 });
}
