import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EDITOR_ROLES = ["admin", "course_creator", "course_manager"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!EDITOR_ROLES.includes(profile?.role ?? "")) return new Response("Forbidden", { status: 403 });

  const sourceId = params.id;

  // Fetch source course
  const { data: source, error: sourceError } = await admin
    .from("courses")
    .select("*")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) return new Response("Course not found", { status: 404 });

  // Create cloned course (unpublished, owned by cloning user)
  const { id: _id, created_at: _ca, created_by: _cb, ...courseFields } = source;
  const { data: cloned, error: cloneError } = await admin
    .from("courses")
    .insert({
      ...courseFields,
      title: `Copy of ${source.title}`,
      published: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (cloneError || !cloned) {
    return new Response("Failed to clone course", { status: 500 });
  }

  const newCourseId = cloned.id;

  // Course creators must be explicitly linked to see/edit their course
  if (profile?.role === "course_creator") {
    await admin.from("course_creator_access").insert({
      creator_id: user.id,
      course_id: newCourseId,
      granted_by: user.id,
    });
  }

  // Fetch all source lessons
  const { data: lessons } = await admin
    .from("lessons")
    .select("*")
    .eq("course_id", sourceId)
    .order("order");

  if (lessons?.length) {
    const { data: newLessons, error: lessonsError } = await admin
      .from("lessons")
      .insert(
        lessons.map(({ id: _id, course_id: _ci, created_at: _ca, ...rest }) => ({
          ...rest,
          course_id: newCourseId,
        }))
      )
      .select("id, order");

    if (lessonsError) {
      await admin.from("courses").delete().eq("id", newCourseId);
      return new Response("Failed to clone lessons", { status: 500 });
    }

    // Build old lesson id → new lesson id map (by matching order)
    const oldLessonsSorted = [...lessons].sort((a, b) => a.order - b.order);
    const newLessonsSorted = [...(newLessons ?? [])].sort((a, b) => a.order - b.order);
    const lessonIdMap: Record<string, string> = {};
    oldLessonsSorted.forEach((old, i) => {
      if (newLessonsSorted[i]) lessonIdMap[old.id] = newLessonsSorted[i].id;
    });

    const oldLessonIds = Object.keys(lessonIdMap);

    // Clone quizzes
    const { data: quizzes } = await admin
      .from("quizzes")
      .select("*")
      .in("lesson_id", oldLessonIds);

    if (quizzes?.length) {
      await admin.from("quizzes").insert(
        quizzes.map(({ id: _id, created_at: _ca, lesson_id, ...rest }) => ({
          ...rest,
          lesson_id: lessonIdMap[lesson_id],
        }))
      );
    }

    // Clone assignments
    const { data: assignments } = await admin
      .from("assignments")
      .select("*")
      .in("lesson_id", oldLessonIds);

    if (assignments?.length) {
      await admin.from("assignments").insert(
        assignments.map(({ id: _id, created_at: _ca, lesson_id, ...rest }) => ({
          ...rest,
          lesson_id: lessonIdMap[lesson_id],
        }))
      );
    }
  }

  // Clone question bank
  const { data: questionBank } = await admin
    .from("question_bank")
    .select("*")
    .eq("course_id", sourceId);

  if (questionBank?.length) {
    await admin.from("question_bank").insert(
      questionBank.map(({ id: _id, created_at: _ca, course_id: _ci, ...rest }) => ({
        ...rest,
        course_id: newCourseId,
        created_by: user.id,
      }))
    );
  }

  // Clone capstone
  const { data: capstone } = await admin
    .from("capstones")
    .select("*")
    .eq("course_id", sourceId)
    .maybeSingle();

  if (capstone) {
    const { id: _id, created_at: _ca, course_id: _ci, ...capstoneFields } = capstone;
    await admin.from("capstones").insert({ ...capstoneFields, course_id: newCourseId });
  }

  // Clone course resources (metadata only — storage files are shared by reference)
  const { data: resources } = await admin
    .from("course_resources")
    .select("*")
    .eq("course_id", sourceId);

  if (resources?.length) {
    await admin.from("course_resources").insert(
      resources.map(({ id: _id, created_at: _ca, course_id: _ci, ...rest }) => ({
        ...rest,
        course_id: newCourseId,
      }))
    );
  }

  return Response.json({ courseId: newCourseId });
}
