"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type FeedbackItem = { criterion: string; score: number; max_points: number; feedback: string };
type Submission = {
  id: string; content: string; status: string;
  ai_total_score: number | null; final_score: number | null;
  final_feedback: FeedbackItem[] | null; instructor_note: string | null;
  file_name: string | null; file_path: string | null; link_url: string | null;
};

export function AssignmentSubmitter({
  assignment, existingSubmission, courseId, lessonId,
}: {
  assignment: any; existingSubmission: Submission | null; courseId: string; lessonId: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const hasAnything = content.trim() || file || linkUrl.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAnything) { setError("Please add a written response, file, or link."); return; }
    setSubmitting(true);
    setError("");

    let filePath: string | null = null;
    let fileName: string | null = null;

    // Upload file to storage if provided
    if (file) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `submissions/${user!.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("lesson-files")
        .upload(path, file);
      if (uploadError) { setError(uploadError.message); setSubmitting(false); return; }
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
      }),
    });

    if (!res.ok) { setError(await res.text()); setSubmitting(false); return; }
    router.refresh();
  }

  // Already submitted — show status and feedback
  if (existingSubmission) {
    const sub = existingSubmission;
    const isApproved = sub.status === "approved";
    const isReturned = sub.status === "returned";
    const supabase = createClient();

    return (
      <div className="space-y-4">
        <div className={`rounded-xl p-4 text-sm font-medium ${
          isApproved ? "bg-green-50 text-green-700" :
          isReturned ? "bg-orange-50 text-orange-700" :
          "bg-blue-50 text-blue-700"
        }`}>
          {isApproved && "✓ Your submission has been reviewed and approved."}
          {isReturned && "↩ Your submission has been returned with feedback."}
          {!isApproved && !isReturned && "⏳ Submitted! Your instructor will review it shortly."}
        </div>

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
                <span className="font-medium">Instructor note: </span>{sub.instructor_note}
              </div>
            )}
          </div>
        )}

        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm">Your submission</h2>
          {sub.content && <p className="text-sm text-gray-600 whitespace-pre-wrap">{sub.content}</p>}
          {sub.file_name && sub.file_path && (
            <a
              href={supabase.storage.from("lesson-files").getPublicUrl(sub.file_path).data.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-600 hover:underline"
            >
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

        <Link href={`/learn/courses/${courseId}/lessons/${lessonId}`} className="inline-block text-sm text-brand-600 hover:underline">
          ← Back to lesson
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            <p className="text-xs text-gray-400">PDF, JPG, PNG, MP4, MOV — max 50MB</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.mp4,.mov,.webm,.doc,.docx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
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

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !hasAnything}
        className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
      >
        {submitting ? "Submitting…" : "Submit assignment"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        AI will evaluate your submission. Your instructor reviews before releasing feedback.
      </p>
    </form>
  );
}
