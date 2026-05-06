import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendNewLessonEmail } from "@/lib/email";
import { z } from "zod";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator"].includes(profile.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { courseId, lessonId } = parsed.data;

  // Get course info
  const { data: course } = await admin
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single();
  if (!course) return new Response("Course not found", { status: 404 });

  // Get the target lesson: specified lessonId, or the most recently added lesson
  let lesson: { id: string; title: string } | null = null;
  if (lessonId) {
    const { data } = await admin
      .from("lessons")
      .select("id, title")
      .eq("id", lessonId)
      .eq("course_id", courseId)
      .single();
    lesson = data;
  } else {
    const { data } = await admin
      .from("lessons")
      .select("id, title")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    lesson = data;
  }

  if (!lesson) return new Response("No lesson found", { status: 404 });

  // Get enrolled users
  const { data: enrollments } = await admin
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId);

  if (!enrollments?.length) return Response.json({ sent: 0 });

  // Find users already notified about this lesson
  const { data: alreadySent } = await admin
    .from("course_reminder_logs")
    .select("user_id")
    .eq("course_id", courseId)
    .eq("lesson_id", lesson.id)
    .eq("type", "new_lesson");

  const alreadySentIds = new Set((alreadySent ?? []).map((r) => r.user_id));
  const pendingIds = enrollments.map((e) => e.user_id).filter((id) => !alreadySentIds.has(id));

  if (!pendingIds.length) return Response.json({ sent: 0 });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const lessonUrl = `${siteUrl}/learn/courses/${courseId}/lessons/${lesson.id}`;

  let sent = 0;
  for (const userId of pendingIds) {
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const email = authData.user?.email;
    const fullName = authData.user?.user_metadata?.full_name ?? "";
    const firstName = fullName.split(" ")[0] || "";

    if (email) {
      await Promise.allSettled([
        sendNewLessonEmail({ to: email, firstName, lessonTitle: lesson.title, courseTitle: course.title, lessonUrl }),
        createNotification({
          user_id: userId,
          type: "new_lesson",
          title: `New lesson: ${lesson.title}`,
          body: `A new lesson has been added to ${course.title}.`,
          link: `/learn/courses/${courseId}/lessons/${lesson.id}`,
        }),
      ]);
    }

    await admin
      .from("course_reminder_logs")
      .insert({ course_id: courseId, lesson_id: lesson.id, user_id: userId, type: "new_lesson" })
      .then(() => null, () => null);

    sent++;
  }

  return Response.json({ sent, lessonTitle: lesson.title });
}
