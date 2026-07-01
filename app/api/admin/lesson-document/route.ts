import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { NextRequest, NextResponse } from "next/server";

// Upload a lesson document (PDF etc.) through the service-role client. Direct
// browser-client Storage writes fail in production ("database schema is
// invalid or incompatible"), so all Storage writes go server-side.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const lessonId = formData.get("lessonId") as string | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!lessonId) return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
  if (file.size > 500 * 1024 * 1024) return NextResponse.json({ error: "Max file size is 500MB." }, { status: 400 });

  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("course_id").eq("id", lessonId).single();
  if (!lesson?.course_id) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const ownerErr = await assertCourseOwner(lesson.course_id, user.id);
  if (ownerErr) return NextResponse.json({ error: "Forbidden" }, { status: ownerErr.status });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${lessonId}/${Date.now()}-${safeName}`;

  const { error } = await admin.storage
    .from("lesson-documents")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from("lesson-documents").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
