"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type RubricItem = { criterion: string; description: string; max_points: number };
type AiFeedbackItem = { criterion: string; score: number; max_points: number; feedback: string };
type AiFeedback = { feedback: AiFeedbackItem[]; overall_comment: string; total_score: number; total_possible: number };

export function SubmissionReviewer({
  submission,
  rubric,
}: {
  submission: any;
  rubric: RubricItem[];
}) {
  const router = useRouter();
  const ai = submission.ai_feedback as AiFeedback | null;

  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries((ai?.feedback ?? []).map((f) => [f.criterion, f.score]))
  );
  const [note, setNote] = useState(submission.instructor_note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const isDone = submission.status === "approved" || submission.status === "returned";

  const totalPossible = rubric.reduce((s, r) => s + r.max_points, 0);
  const totalScore = Object.values(scores).reduce((s, v) => s + Number(v), 0);

  async function handleAction(action: "approve" | "return") {
    setSubmitting(true);
    await fetch("/api/submissions/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: submission.id,
        action,
        final_score: totalScore,
        instructor_note: note,
        final_feedback: ai?.feedback?.map((f) => ({
          ...f,
          score: scores[f.criterion] ?? f.score,
        })),
      }),
    });
    setSubmitting(false);
    router.push("/admin/submissions");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Submission content */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Learner submission</h2>
        {submission.content && (
          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            {submission.content}
          </div>
        )}
        {submission.file_name && submission.file_path && (
          <a
            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lesson-files/${submission.file_path}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 hover:underline"
          >
            📎 {submission.file_name}
          </a>
        )}
        {submission.link_url && (
          <a href={submission.link_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
            🔗 {submission.link_url}
          </a>
        )}
      </div>

      {/* AI feedback */}
      {ai ? (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">AI Evaluation</h2>
            <span className="text-sm font-medium text-brand-600">
              {totalScore} / {totalPossible} pts
            </span>
          </div>

          {ai.overall_comment && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <span className="font-medium">Overall: </span>{ai.overall_comment}
            </div>
          )}

          <div className="space-y-3">
            {(ai.feedback ?? []).map((item, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{item.criterion}</span>
                  <div className="flex items-center gap-1">
                    {isDone ? (
                      <span className="text-sm font-medium">{scores[item.criterion] ?? item.score}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={item.max_points}
                        value={scores[item.criterion] ?? item.score}
                        onChange={(e) =>
                          setScores({ ...scores, [item.criterion]: Number(e.target.value) })
                        }
                        className="w-14 border rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    )}
                    <span className="text-xs text-gray-400">/ {item.max_points}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600">{item.feedback}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          AI evaluation is still processing. Refresh in a moment.
        </div>
      )}

      {/* Instructor note */}
      <div className="bg-white border rounded-xl p-5">
        <label className="block text-sm font-medium mb-1">
          Instructor note <span className="text-gray-400">(optional — shown to learner)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          disabled={isDone}
          placeholder="Add a personal note for the learner…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50"
        />
      </div>

      {/* Actions */}
      {isDone ? (
        <div className={`rounded-xl p-4 text-sm font-medium text-center ${
          submission.status === "approved" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {submission.status === "approved" ? "✓ Approved and released to learner" : "↩ Returned to learner"}
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => handleAction("return")}
            disabled={submitting || !ai}
            className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            ↩ Return to learner
          </button>
          <button
            onClick={() => handleAction("approve")}
            disabled={submitting || !ai}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            ✓ Approve & release
          </button>
        </div>
      )}
    </div>
  );
}
