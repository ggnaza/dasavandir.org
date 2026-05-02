import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";

const RICH = { ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"], ALLOWED_ATTR: [] as string[] };

const schema = z.object({
  body: z.string().min(1).max(10_000),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { allowed } = await checkRateLimit(`reply:${user.id}`, 20, 60 * 60_000);
  if (!allowed) return rateLimitResponse({ limit: 20, windowSecs: 3600 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const cleanBody = DOMPurify.sanitize(parsed.data.body.trim(), RICH);
  if (!cleanBody) return new Response("Missing body", { status: 400 });

  const admin = createAdminClient();

  const { data: discussion } = await admin
    .from("discussions")
    .select("course_id, user_id")
    .eq("id", params.id)
    .single();

  if (!discussion) return new Response("Not found", { status: 404 });

  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    admin.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", discussion.course_id).single(),
    admin.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (!enrollment && profile.role !== "admin")
    return new Response("Not enrolled", { status: 403 });

  const { data, error } = await admin.from("discussion_replies").insert({
    discussion_id: params.id,
    user_id: user.id,
    body: cleanBody,
  }).select().single();

  if (error) {
    console.error("[replies/post]", error);
    return new Response("Failed to post reply", { status: 500 });
  }

  if (discussion.user_id !== user.id) {
    await createNotification({
      user_id: discussion.user_id,
      type: "reply",
      title: "New reply to your discussion",
      body: `Someone replied to your discussion.`,
      link: `/learn/courses/${discussion.course_id}/discussions/${params.id}`,
    });
  }

  return Response.json(data);
}
