import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendInviteLinkEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({ userId: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (callerProfile?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

    const { userId } = parsed.data;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (!profile?.email) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email: profile.email,
      options: { redirectTo: `${siteUrl}/auth/set-password` },
    });

    if (linkError) {
      console.error("[resend-invite]", linkError);
      return new Response(JSON.stringify({ error: linkError.message }), { status: 400 });
    }

    await sendInviteLinkEmail({
      to: profile.email,
      fullName: profile.full_name || "",
      inviteUrl: linkData.properties.action_link,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error("[resend-invite]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
