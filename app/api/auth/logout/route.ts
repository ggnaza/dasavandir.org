import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  // scope: "global" revokes the refresh token server-side — extracted JWTs become
  // unusable after the next token refresh, rather than surviving until natural expiry.
  await supabase.auth.signOut({ scope: "global" });
  return new Response("OK");
}
