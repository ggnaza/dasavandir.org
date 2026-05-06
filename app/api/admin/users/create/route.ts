import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import { sendInviteLinkEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(254),
  fullName: z.string().min(1).max(200),
  role: z.enum(["admin", "course_creator", "course_manager", "learner"]).optional().default("learner"),
});

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });

    const { email, fullName, role } = parsed.data;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Check if user already exists in profiles
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      await admin.from("profiles").update({ role, full_name: fullName }).eq("id", existingProfile.id);
      return new Response(
        JSON.stringify({ success: true, message: "User already exists — role updated." }),
        { status: 200 }
      );
    }

    // New user — generate invite link
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${siteUrl}/auth/set-password`,
        data: { full_name: fullName },
      },
    });

    if (linkError) {
      console.error("[users/create invite]", linkError);
      return new Response(JSON.stringify({ error: linkError.message }), { status: 400 });
    }

    // Trigger is disabled — create profile explicitly
    await admin.from("profiles").upsert({
      id: linkData.user.id,
      full_name: fullName,
      email,
      role,
      status: "pending",
    }, { onConflict: "id" });

    await sendInviteLinkEmail({ to: email, fullName, inviteUrl: linkData.properties.action_link });

    await logAudit("create_user", user.id, req, {
      email, full_name: fullName, role, new_user_id: linkData.user.id,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error("[users/create]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
