import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { NewDiscussionForm } from "./new-discussion-form";

export default async function NewDiscussionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: course } = await admin
    .from("courses")
    .select("id, title")
    .eq("id", params.id)
    .eq("published", true)
    .single();

  if (!course) notFound();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user!.id)
    .eq("course_id", params.id)
    .single();

  if (!enrollment) redirect(`/courses/${params.id}`);

  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title")
    .eq("course_id", params.id)
    .order("order");

  return (
    <div className="max-w-2xl">
      <NewDiscussionForm courseId={params.id} lessons={lessons ?? []} />
    </div>
  );
}
