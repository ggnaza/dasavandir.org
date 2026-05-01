"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Question = { question: string; options: string[]; correct: number };
type Quiz = { id: string; questions: Question[] };
type Response = { answers: number[]; score: number };

export function QuizTaker({
  quiz,
  userId,
  lastResponse,
  courseId,
  lessonId,
}: {
  quiz: Quiz;
  userId: string;
  lastResponse: Response | null;
  courseId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(
    lastResponse?.answers ?? Array(quiz.questions.length).fill(null)
  );
  const [submitted, setSubmitted] = useState(!!lastResponse);
  const [score, setScore] = useState<number | null>(lastResponse?.score ?? null);
  const [submitting, setSubmitting] = useState(false);

  const total = quiz.questions.length;
  const allAnswered = answers.every((a) => a !== null);

  async function handleSubmit() {
    setSubmitting(true);
    const correct = quiz.questions.filter((q, i) => answers[i] === q.correct).length;
    const pct = Math.round((correct / total) * 100);
    const supabase = createClient();
    await supabase.from("quiz_responses").insert({
      quiz_id: quiz.id,
      user_id: userId,
      answers,
      score: pct,
    });
    setScore(pct);
    setSubmitted(true);
    setSubmitting(false);
    router.refresh();
  }

  function retake() {
    setAnswers(Array(total).fill(null));
    setSubmitted(false);
    setScore(null);
  }

  if (submitted && score !== null) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center">
        <div className={`text-5xl font-bold mb-2 ${score >= 80 ? "text-green-600" : "text-orange-500"}`}>
          {score}%
        </div>
        <p className="text-gray-500 mb-1">
          {score >= 80 ? "Great job! You passed." : "You need 80% to complete this lesson."}
        </p>
        {score >= 80 && (
          <p className="text-sm text-green-600 mb-5">✓ You can now mark this lesson as complete.</p>
        )}
        {score < 80 && (
          <p className="text-sm text-orange-600 mb-5">Score: {score}% — try again to reach 80%.</p>
        )}
        <div className="space-y-3 text-left mb-6">
          {quiz.questions.map((q, i) => {
            const chosen = answers[i];
            const correct = q.correct;
            const isRight = chosen === correct;
            return (
              <div key={i} className={`p-3 rounded-lg text-sm ${isRight ? "bg-green-50" : "bg-red-50"}`}>
                <p className="font-medium mb-1">{q.question}</p>
                <p className={isRight ? "text-green-700" : "text-red-700"}>
                  {isRight ? "✓" : "✗"} Your answer: {chosen !== null ? q.options[chosen] : "—"}
                </p>
                {!isRight && (
                  <p className="text-green-700">✓ Correct: {q.options[correct]}</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={retake} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50">
            Retake quiz
          </button>
          <Link
            href={`/learn/courses/${courseId}/lessons/${lessonId}`}
            className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700"
          >
            Back to lesson
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {quiz.questions.map((q, qi) => (
        <div key={qi} className="bg-white border rounded-xl p-5">
          <p className="font-medium mb-3">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                  answers[qi] === oi ? "border-brand-500 bg-brand-50" : "border-transparent hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name={`q-${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => {
                    const updated = [...answers];
                    updated[qi] = oi;
                    setAnswers(updated);
                  }}
                  className="shrink-0"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
      >
        {submitting ? "Submitting…" : "Submit quiz"}
      </button>
    </div>
  );
}
