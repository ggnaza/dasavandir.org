import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { QuizTaker } from "./quiz-taker";

export default async function LearnQuizPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: quiz }, { data: lesson }, { data: lastResponse }] = await Promise.all([
    admin.from("quizzes").select("*").eq("lesson_id", params.lessonId).single(),
    admin.from("lessons").select("id, title").eq("id", params.lessonId).single(),
    admin
      .from("quiz_responses")
      .select("*")
      .eq("user_id", user!.id)
      .eq("quiz_id", (await admin.from("quizzes").select("id").eq("lesson_id", params.lessonId).single()).data?.id ?? "")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (!quiz) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/learn/courses/${params.id}/lessons/${params.lessonId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to lesson
        </Link>
        <h1 className="text-2xl font-bold mt-2">Quiz — {lesson?.title}</h1>
      </div>
      <QuizTaker
        quiz={quiz}
        userId={user!.id}
        lastResponse={lastResponse}
        courseId={params.id}
        lessonId={params.lessonId}
      />
    </div>
  );
}
