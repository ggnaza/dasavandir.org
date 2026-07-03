"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LessonHtmlRenderer } from "@/components/lesson-html-renderer";

type RubricItem = { criterion: string; description: string; max_points: number };
type AiFeedbackItem = { criterion: string; score: number; max_points: number; feedback: string };
type AiFeedback = { feedback: AiFeedbackItem[]; overall_comment: string; total_score: number; total_possible: number };

type Verdict = "approve" | "needs_revision" | "not_approved" | null;

const VERDICT_CONFIG = {
  approve: {
    label: "Approved",
    icon: "✓",
    description: "Work meets the standard. Released to learner.",
    activeClass: "border-green-500 bg-green-50 text-green-800",
    btnClass: "bg-green-600 hover:bg-green-700 text-white",
    noteRequired: false,
    noteLabel: "Optional note for the learner",
    notePlaceholder: "Well done! Any encouraging message…",
  },
  needs_revision: {
    label: "Needs to be Revised",
    icon: "↩",
    description: "Work is incomplete. Reopened for the learner to revise and resubmit.",
    activeClass: "border-amber-500 bg-amber-50 text-amber-900",
    btnClass: "bg-amber-500 hover:bg-amber-600 text-white",
    noteRequired: true,
    noteLabel: "Revision note (required — shown to learner)",
    notePlaceholder: "Describe specifically what needs to be improved and why…",
  },
  not_approved: {
    label: "Not Approved",
    icon: "✕",
    description: "Work does not meet the standard. Final — no resubmission.",
    activeClass: "border-red-500 bg-red-50 text-red-900",
    btnClass: "bg-red-600 hover:bg-red-700 text-white",
    noteRequired: false,
    noteLabel: "Feedback for the learner (recommended)",
    notePlaceholder: "Explain why the submission does not meet requirements…",
  },
} as const;

const STATUS_DISPLAY: Record<string, { label: string; cls: string }> = {
  approved:       { label: "Approved",          cls: "bg-green-100 text-green-700 border-green-200" },
  needs_revision: { label: "Needs Revision",    cls: "bg-amber-100 text-amber-700 border-amber-200" },
  not_approved:   { label: "Not Approved",      cls: "bg-red-100 text-red-700 border-red-200" },
  returned:       { label: "Returned",          cls: "bg-orange-100 text-orange-700 border-orange-200" },
  submitted:      { label: "Submitted",         cls: "bg-blue-100 text-blue-700 border-blue-200" },
  ai_reviewed:    { label: "AI Reviewed",       cls: "bg-purple-100 text-purple-700 border-purple-200" },
};

export function SubmissionReviewer({
  submission,
  rubric,
  instructions,
  maxScore,
  fileUrl,
}: {
  submission: any;
  rubric: RubricItem[];
  instructions: string;
  maxScore: number | null;
  fileUrl?: string | null;
}) {
  const router = useRouter();
  const ai = submission.ai_feedback as AiFeedback | null;

  const [verdict, setVerdict] = useState<Verdict>(null);
  const [note, setNote] = useState(submission.instructor_note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isDone = ["approved", "not_approved", "needs_revision", "returned"].includes(submission.status);
  const verdictConfig = verdict ? VERDICT_CONFIG[verdict] : null;

  async function handleSubmit() {
    if (!verdict) return;
    if (VERDICT_CONFIG[verdict].noteRequired && !note.trim()) {
      setError("A revision note is required when returning for revision.");
      return;
    }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/submissions/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: submission.id,
        action: verdict,
        instructor_note: note.trim() || null,
        final_score: ai?.total_score ?? null,
        final_feedback: ai?.feedback ?? null,
      }),
    });

    if (!res.ok) {
      setError(await res.text());
      setSubmitting(false);
      return;
    }

    router.push("/admin/submissions");
    router.refresh();
  }

  const statusDisplay = STATUS_DISPLAY[submission.status] ?? { label: submission.status, cls: "bg-gray-100 text-gray-600 border-gray-200" };

  return (
    <div className="flex gap-5 items-start min-h-[75vh]">
      {/* ── LEFT: Submission content ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Assignment context */}
        {instructions && (
          <div className="bg-gray-50 border rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assignment brief</p>
            <LessonHtmlRenderer content={instructions} />
          </div>
        )}

        {/* Rubric */}
        {rubric.length > 0 && (
          <div className="bg-white border rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Rubric</p>
            <div className="space-y-2">
              {rubric.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{item.criterion}</span>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{item.max_points} pts</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between text-xs text-gray-500 font-medium">
                <span>Total</span>
                <span>{rubric.reduce((s, r) => s + r.max_points, 0)} pts</span>
              </div>
            </div>
          </div>
        )}

        {/* Submitted work */}
        <div className="bg-white border rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Submitted work</p>
          {submission.content ? (
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              {submission.content}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No written response.</p>
          )}
          {submission.file_name && fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 text-sm text-brand-600 hover:underline"
            >
              📎 {submission.file_name}
            </a>
          )}
          {submission.link_url && (
            <a
              href={submission.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 text-sm text-brand-600 hover:underline"
            >
              🔗 {submission.link_url}
            </a>
          )}
        </div>

        {/* AI evaluation */}
        {ai && (
          <div className="bg-white border rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">✦ AI Pre-evaluation</p>
              <span className="text-sm font-semibold text-brand-600">{ai.total_score} / {ai.total_possible} pts</span>
            </div>
            {ai.overall_comment && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800 mb-3">
                {ai.overall_comment}
              </div>
            )}
            <div className="space-y-2">
              {(ai.feedback ?? []).map((item, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{item.criterion}</span>
                    <span className="text-xs text-gray-500">{item.score} / {item.max_points}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!ai && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-sm text-yellow-800">
            ⏳ AI evaluation still processing — you can evaluate manually.
          </div>
        )}
      </div>

      {/* ── RIGHT: Evaluation panel ───────────────────────────────────── */}
      <div className="w-80 shrink-0 sticky top-8 space-y-4">

        {/* Current status */}
        <div className={`border rounded-xl px-4 py-3 text-sm font-medium ${statusDisplay.cls}`}>
          Status: {statusDisplay.label}
        </div>

        {isDone ? (
          /* Already reviewed — show the decision */
          <div className="bg-white border rounded-xl px-5 py-5 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review decision</p>
            <div className={`rounded-lg px-4 py-3 text-sm font-medium border ${statusDisplay.cls}`}>
              {statusDisplay.label}
            </div>
            {submission.instructor_note && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Note to learner</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                  {submission.instructor_note}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Evaluation form */
          <div className="bg-white border rounded-xl px-5 py-5 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your evaluation</p>

            {/* Three verdict options */}
            <div className="space-y-2">
              {(["approve", "needs_revision", "not_approved"] as const).map((v) => {
                const cfg = VERDICT_CONFIG[v];
                const isSelected = verdict === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setVerdict(v); setError(""); }}
                    className={`w-full text-left border-2 rounded-xl px-4 py-3 transition-all ${
                      isSelected
                        ? cfg.activeClass + " border-2"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold">{cfg.icon}</span>
                      <span className="text-sm font-semibold">{cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 ml-6 leading-snug">{cfg.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Note field — appears when a verdict is selected */}
            {verdict && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  {verdictConfig!.noteLabel}
                  {verdictConfig!.noteRequired && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => { setNote(e.target.value); setError(""); }}
                  rows={4}
                  placeholder={verdictConfig!.notePlaceholder}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none ${
                    error && verdictConfig!.noteRequired ? "border-red-400" : ""
                  }`}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!verdict || submitting}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${
                verdict ? VERDICT_CONFIG[verdict].btnClass : "bg-gray-200 text-gray-400"
              }`}
            >
              {submitting
                ? "Saving…"
                : verdict
                ? `${VERDICT_CONFIG[verdict].icon} ${VERDICT_CONFIG[verdict].label}`
                : "Select a verdict above"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Your decision will be recorded and the learner will be notified.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
