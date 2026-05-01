import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { QuizTaker } from "./quiz-taker";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function LearnQuizPage({
  params,
}: {
  params: { id: string; lessonId: string };
}) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: quiz }, { data: lesson }] = await Promise.all([
    admin.from("quizzes").select("*").eq("lesson_id", params.lessonId).single(),
    admin.from("lessons").select("id, title").eq("id", params.lessonId).single(),
  ]);

  if (!quiz) notFound();

  const { data: lastResponse } = await admin
    .from("quiz_responses")
    .select("*")
    .eq("user_id", user!.id)
    .eq("quiz_id", quiz.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();

  // If quiz uses question bank, pick random questions
  let questions = quiz.questions ?? [];
  if (quiz.use_bank) {
    const { data: bankQuestions } = await admin
      .from("question_bank")
      .select("question, options, correct")
      .eq("course_id", params.id);

    if (bankQuestions && bankQuestions.length > 0) {
      const count = quiz.bank_count ?? 5;
      questions = shuffle(bankQuestions).slice(0, count);
    }
  }

  const quizForTaker = { ...quiz, questions };

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
        {quiz.use_bank && (
          <p className="text-sm text-gray-400 mt-1">Questions are randomly selected each attempt.</p>
        )}
      </div>
      <QuizTaker
        quiz={quizForTaker}
        userId={user!.id}
        lastResponse={lastResponse ?? null}
        courseId={params.id}
        lessonId={params.lessonId}
      />
    </div>
  );
}
