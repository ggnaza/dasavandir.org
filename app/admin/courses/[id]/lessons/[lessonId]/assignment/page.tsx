import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { AssignmentEditor } from "./assignment-editor";

export default async function AssignmentPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const admin = createAdminClient();
  const [{ data: lesson }, { data: assignment }] = await Promise.all([
    admin.from("lessons").select("id, title, content").eq("id", params.lessonId).single(),
    admin.from("assignments").select("*").eq("lesson_id", params.lessonId).single(),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/admin/courses/${params.id}/lessons/${params.lessonId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to lesson
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          {assignment ? "Edit Assignment" : "Add Assignment"} — {lesson?.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Learners submit written responses. AI evaluates against your rubric. You review before releasing feedback.
        </p>
      </div>
      <AssignmentEditor
        lessonId={params.lessonId}
        existing={assignment}
        lessonTitle={lesson?.title ?? ""}
        lessonContent={lesson?.content ?? ""}
      />
    </div>
  );
}
