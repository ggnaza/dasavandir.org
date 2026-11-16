import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { NextRequest, NextResponse } from "next/server";
import { lessonDocumentFiles, lessonDocumentStoragePath } from "@/lib/lesson-documents";

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

// GET /api/admin/lesson-document?lessonId=…&url=… — a short-lived signed URL so
// course staff can preview an uploaded document from the lesson editor (the
// lesson-documents bucket is private). Only a url that is one of this lesson's
// own documents (cloned lessons point at the source lesson's folder, so a
// folder-prefix check would wrongly refuse them).
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lessonId = request.nextUrl.searchParams.get("lessonId");
  const url = request.nextUrl.searchParams.get("url");
  if (!lessonId || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("course_id, document_url, document_files")
    .eq("id", lessonId)
    .single();
  if (!lesson?.course_id) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  const ownerErr = await assertCourseOwner(lesson.course_id, user.id);
  if (ownerErr) return NextResponse.json({ error: "Forbidden" }, { status: ownerErr.status });

  if (!lessonDocumentFiles(lesson).some((f) => f.url === url)) {
    return NextResponse.json({ error: "Not a document of this lesson" }, { status: 403 });
  }
  const path = lessonDocumentStoragePath(url);
  if (!path) return NextResponse.json({ url }); // external link (Drive etc.) — open as-is
  const { data, error } = await admin.storage.from("lesson-documents").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Could not open file" }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
