"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type FeedbackItem = { criterion: string; score: number; max_points: number; feedback: string };
type Submission = {
  id: string; content: string; status: string; user_id?: string;
  ai_total_score: number | null; final_score: number | null;
  final_feedback: FeedbackItem[] | null; instructor_note: string | null;
  file_name: string | null; file_path: string | null; link_url: string | null;
};
type GroupMember = { id: string; name: string; email: string };

/** Transform a Google Docs/Slides edit URL → copy URL for Option-A template flow */
function toCopyUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove /edit, /view, /preview suffixes and append /copy
    const cleaned = u.pathname.replace(/\/(edit|view|preview|copy)(\/.*)?$/, "");
    u.pathname = cleaned + "/copy";
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function AssignmentSubmitter({
  assignment,
  existingSubmission,
  existingFileUrl,
  courseId,
  lessonId,
  preSubmissionAiEnabled,
  isGroupAssignment = false,
  group,
  groupSubmitterName,
}: {
  assignment: any;
  existingSubmission: Submission | null;
  existingFileUrl?: string | null;
  courseId: string;
  lessonId: string;
  preSubmissionAiEnabled?: boolean;
  isGroupAssignment?: boolean;
  group?: { id: string; name: string; members: GroupMember[] } | null;
  groupSubmitterName?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [loadingAiFeedback, setLoadingAiFeedback] = useState(false);
  const [aiFeedbackError, setAiFeedbackError] = useState("");
  const [revising, setRevising] = useState(false);

  const hasAnything = content.trim() || file || linkUrl.trim();

  // ── Locked state: group assignment but learner not in a group ──────────────
  if (isGroupAssignment && !group) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-2xl mb-3">👥</p>
        <p className="text-base font-semibold text-gray-700">You haven't been assigned to a group yet</p>
        <p className="text-sm text-gray-500 mt-2">
          Contact your facilitator to be added to a group before you can submit this assignment.
        </p>
      </div>
    );
  }

  async function handleAiFeedback() {
    const hasPdf = file && file.type === "application/pdf";
    if (!content.trim() && !hasPdf) {
      setAiFeedbackError("Write a response or upload a PDF first, then get AI feedback.");
      return;
    }
    setLoadingAiFeedback(true);
    setAiFeedbackError("");
    setAiFeedback("");

    let res: Response;
    if (hasPdf) {
      const form = new FormData();
      form.append("assignment_id", assignment.id);
      form.append("draft", content);
      form.append("file", file);
      res = await fetch("/api/assignments/prefeedback", { method: "POST", body: form });
    } else {
      res = await fetch("/api/assignments/prefeedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignment.id, draft: content }),
      });
    }

    if (!res.ok) { setAiFeedbackError(await res.text()); setLoadingAiFeedback(false); return; }
    const { feedback } = await res.json();
    setAiFeedback(feedback);
    setLoadingAiFeedback(false);
  }

  const ALLOWED_TYPES = new Set([
    "application/pdf",
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/quicktime", "video/webm",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  const MAX_FILE_BYTES = 500 * 1024 * 1024;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAnything) { setError("Please add a written response, file, or link."); return; }
    setSubmitting(true);
    setError("");

    let filePath: string | null = null;
    let fileName: string | null = null;

    if (file) {
      if (file.size > MAX_FILE_BYTES) { setError("File too large — max 500 MB."); setSubmitting(false); return; }
      if (!ALLOWED_TYPES.has(file.type)) { setError("File type not allowed."); setSubmitting(false); return; }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `submissions/${user!.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("lesson-files").upload(path, file);
      if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setSubmitting(false); return; }
      filePath = path;
      fileName = file.name;
    }

    const res = await fetch("/api/submissions/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignment_id: assignment.id,
        content: content.trim() || null,
        file_path: filePath,
        file_name: fileName,
        link_url: linkUrl.trim() || null,
        group_id: isGroupAssignment && group ? group.id : null,
      }),
    });

    if (!res.ok) { setError(await res.text()); setSubmitting(false); return; }
    router.refresh();
  }

  // ── Already submitted — show status ───────────────────────────────────────
  if (existingSubmission && !revising) {
    const sub = existingSubmission;
    const isApproved = sub.status === "approved";
    const isReturned = sub.status === "returned";
    const isNeedsRevision = sub.status === "needs_revision";
    const isNotApproved = sub.status === "not_approved";
    const isFinal = isApproved || isNotApproved;
    const isPending = ["submitted", "ai_reviewed"].includes(sub.status);

    return (
      <div className="space-y-4">
        {/* Group panel — shown even in submitted state */}
        {isGroupAssignment && group && (
          <GroupPanel group={group} currentUserId={undefined} />
        )}

        {/* Status banner */}
        <div className={`rounded-xl p-4 text-sm font-medium ${
          isApproved ? "bg-green-50 text-green-700 border border-green-200" :
          isNeedsRevision ? "bg-amber-50 text-amber-800 border border-amber-200" :
          isNotApproved ? "bg-red-50 text-red-700 border border-red-200" :
          isReturned ? "bg-orange-50 text-orange-700 border border-orange-200" :
          "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {isApproved && "✓ Your submission has been reviewed and approved."}
          {isNeedsRevision && (
            isGroupAssignment
              ? "↩ Your group's submission needs revision. See the facilitator's note below."
              : "↩ Your submission needs revision. Please read the facilitator's note below, then revise and resubmit."
          )}
          {isNotApproved && "✕ Your submission was not approved. Please read the feedback below."}
          {isReturned && "↩ Your submission has been returned with feedback."}
          {isPending && (
            <span>
              {isGroupAssignment && groupSubmitterName
                ? `⏳ Submitted by ${groupSubmitterName} — your facilitator will review it shortly.`
                : "⏳ Submitted — your facilitator will review it shortly."}
            </span>
          )}
        </div>

        {/* Instructor note for needs_revision */}
        {isNeedsRevision && sub.instructor_note && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Facilitator's note</p>
            <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{sub.instructor_note}</p>
          </div>
        )}

        {/* Feedback for approved / returned */}
        {(isApproved || isReturned) && sub.final_feedback && (
          <div className="bg-white border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Feedback</h2>
              <span className="text-sm font-medium text-brand-600">{sub.final_score} pts</span>
            </div>
            {sub.final_feedback.map((item, i) => (
              <div key={i} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{item.criterion}</span>
                  <span className="text-sm text-gray-500">{item.score} / {item.max_points}</span>
                </div>
                <p className="text-xs text-gray-600">{item.feedback}</p>
              </div>
            ))}
            {sub.instructor_note && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                <span className="font-medium">Facilitator note: </span>{sub.instructor_note}
              </div>
            )}
          </div>
        )}

        {/* Submitted work */}
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">Submitted work</h2>
          {sub.content && <p className="text-sm text-gray-600 whitespace-pre-wrap">{sub.content}</p>}
          {sub.file_name && existingFileUrl && (
            <a href={existingFileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
              📎 {sub.file_name}
            </a>
          )}
          {sub.link_url && (
            <a href={sub.link_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
              🔗 {sub.link_url}
            </a>
          )}
        </div>

        {/* Revision CTA */}
        {isNeedsRevision && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-amber-800 mb-1">
              {isGroupAssignment ? "Ready to revise as a group?" : "Ready to revise?"}
            </p>
            <p className="text-xs text-amber-700 mb-3">
              {isGroupAssignment
                ? "Anyone in your group can start the revision. Your new submission will replace the previous one."
                : "Your previous submission will be replaced. Make sure your revision addresses all the facilitator's feedback."}
            </p>
            <button
              onClick={() => setRevising(true)}
              className="text-sm bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 font-medium"
            >
              Start revision →
            </button>
          </div>
        )}

        <Link href={`/learn/courses/${courseId}/lessons/${lessonId}`} className="inline-block text-sm text-brand-600 hover:underline">
          ← Back to lesson
        </Link>
      </div>
    );
  }

  // ── Submission form ────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Group panel */}
      {isGroupAssignment && group && (
        <GroupPanel group={group} currentUserId={undefined} />
      )}

      {/* Revision banner */}
      {revising && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-amber-800 font-medium">
            ↩ {isGroupAssignment ? "Group revision" : "Revision"} — your new submission will replace the previous one.
          </span>
          <button type="button" onClick={() => setRevising(false)}
            className="text-amber-600 hover:underline text-xs ml-3 shrink-0">Cancel</button>
        </div>
      )}

      {/* Google Docs template */}
      {assignment.template_url && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-indigo-900">📄 Template provided</p>
          <p className="text-xs text-indigo-700">
            Click below to open a copy of the template in Google. After copying, change sharing to
            <strong> "Anyone with the link can view"</strong>, then paste the URL in the link field below.
          </p>
          <div className="flex gap-2">
            <a
              href={toCopyUrl(assignment.template_url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(() => linkRef.current?.focus(), 800)}
              className="inline-block text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium"
            >
              Copy template to my Google Drive →
            </a>
          </div>
        </div>
      )}

      {/* Text */}
      <div className="bg-white border rounded-xl p-5">
        <label className="block text-sm font-medium mb-1">
          Written response <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Write your response here…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* File upload */}
      <div className="bg-white border rounded-xl p-5">
        <label className="block text-sm font-medium mb-2">
          Attach a file <span className="text-gray-400">(PDF, image, video — optional)</span>
        </label>
        <label className="cursor-pointer flex items-center gap-3 border-2 border-dashed rounded-lg p-4 hover:bg-gray-50 transition">
          <span className="text-2xl">{file ? "📎" : "📄"}</span>
          <div>
            <p className="text-sm font-medium">{file ? file.name : "Choose file"}</p>
            <p className="text-xs text-gray-400">PDF, JPG, PNG, MP4, MOV — max 500MB</p>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.mp4,.mov,.webm,.doc,.docx"
            className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && (
          <button type="button" onClick={() => setFile(null)} className="text-xs text-red-500 mt-1 hover:underline">
            Remove
          </button>
        )}
      </div>

      {/* Link */}
      <div className="bg-white border rounded-xl p-5">
        <label className="block text-sm font-medium mb-1">
          Paste a link <span className="text-gray-400">(Google Drive, YouTube, Loom, etc. — optional)</span>
        </label>
        <input
          ref={linkRef}
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Rubric */}
      {assignment.rubric?.length > 0 && (
        <div className="bg-gray-50 border rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">You will be evaluated on:</p>
          <ul className="space-y-1">
            {assignment.rubric.map((item: any, i: number) => (
              <li key={i} className="text-xs text-gray-600 flex justify-between">
                <span>{item.criterion}</span>
                <span className="text-gray-400">{item.max_points} pts</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            Total: {assignment.rubric.reduce((s: number, r: any) => s + r.max_points, 0)} points
          </p>
        </div>
      )}

      {/* Pre-submission AI feedback */}
      {preSubmissionAiEnabled && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-brand-900">✦ Get AI feedback before submitting</p>
              <p className="text-xs text-brand-700">AI reviews your written response or uploaded PDF and suggests improvements.</p>
            </div>
            <button
              type="button"
              onClick={handleAiFeedback}
              disabled={loadingAiFeedback || (!content.trim() && !(file && file.type === "application/pdf"))}
              className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium shrink-0"
            >
              {loadingAiFeedback ? "Reviewing…" : "Review my draft"}
            </button>
          </div>
          {aiFeedbackError && <p className="text-red-600 text-xs">{aiFeedbackError}</p>}
          {aiFeedback && (
            <div className="bg-white rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap border">
              <p className="text-xs font-semibold text-brand-700 mb-2">AI suggestions (not your final grade):</p>
              {aiFeedback}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !hasAnything}
        className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
      >
        {submitting
          ? "Submitting…"
          : isGroupAssignment && group
          ? `Submit on behalf of ${group.name}`
          : "Submit assignment"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        {isGroupAssignment
          ? "AI will evaluate your submission. Your facilitator reviews before releasing feedback to the whole group."
          : "AI will evaluate your submission. Your instructor reviews before releasing feedback."}
      </p>
    </form>
  );
}

// ── Group Panel component ────────────────────────────────────────────────────
function GroupPanel({
  group,
  currentUserId,
}: {
  group: { id: string; name: string; members: GroupMember[] };
  currentUserId: string | undefined;
}) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">👥</span>
        <span className="text-sm font-semibold text-indigo-900">{group.name}</span>
        <span className="text-xs text-indigo-500 ml-auto">{group.members.length} members</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {group.members.map((m) => (
          <div
            key={m.id}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border ${
              m.id === currentUserId
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-indigo-800 border-indigo-200"
            }`}
          >
            <span>{m.id === currentUserId ? "👤" : "○"}</span>
            <span className="font-medium">{m.name.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
