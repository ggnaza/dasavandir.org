import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCourseOwner } from "@/lib/assert-course-owner";
import { NextRequest, NextResponse } from "next/server";

// Upload a course cover image through the service-role client. Direct
// browser-client Storage writes fail in production ("database schema is
// invalid or incompatible"), so all Storage writes go server-side.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const courseId = formData.get("courseId") as string | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!courseId) return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Max image size is 5MB." }, { status: 400 });

  const ownerErr = await assertCourseOwner(courseId, user.id);
  if (ownerErr) return NextResponse.json({ error: "Forbidden" }, { status: ownerErr.status });

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${courseId}/cover.${ext || "jpg"}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("course-covers")
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from("course-covers").getPublicUrl(path);
  // Cache-bust: the storage path is stable (`{courseId}/cover.ext`, upsert), so
  // a replaced cover would otherwise keep serving the old bytes from cache.
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  // Persist the cover URL immediately. The editor form only stages the URL in
  // local state and writes it on "Save changes" (via the browser client, whose
  // error is discarded) — so an upload with no subsequent Save silently
  // vanished on refresh. Writing here through the service-role client makes the
  // upload durable on its own, independent of the Save button.
  const { error: updateError } = await admin
    .from("courses")
    .update({ cover_image_url: publicUrl })
    .eq("id", courseId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ url: publicUrl });
}
