import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { QuizEditor } from "./quiz-editor";

export default async function AdminQuizPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const admin = createAdminClient();
  const [{ data: lesson }, { data: quiz }] = await Promise.all([
    admin.from("lessons").select("id, title").eq("id", params.lessonId).single(),
    admin.from("quizzes").select("*").eq("lesson_id", params.lessonId).single(),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/admin/courses/${params.id}/lessons/${params.lessonId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to lesson
        </Link>
        <h1 className="text-2xl font-bold mt-2">Quiz — {lesson?.title}</h1>
        <p className="text-sm text-gray-500 mt-1">Multiple choice questions. Learners see results immediately.</p>
      </div>
      <QuizEditor lessonId={params.lessonId} existing={quiz} />
    </div>
  );
}
