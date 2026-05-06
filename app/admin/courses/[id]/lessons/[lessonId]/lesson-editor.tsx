"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LessonContentEditor } from "@/components/lesson-content-editor-dynamic";
import { ChaptersEditor } from "./chapters-editor";

function PreviewModal({ courseId, lessonId, onClose }: { courseId: string; lessonId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 shrink-0" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-gray-300 font-medium">Lesson preview</p>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none px-2">✕</button>
      </div>
      <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={`/admin/courses/${courseId}/lessons/${lessonId}/preview`}
          className="w-full h-full border-0"
          title="Lesson preview"
        />
      </div>
    </div>
  );
}

type Lesson = {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null;
  audio_url: string | null;
  document_url: string | null;
  slides_url: string | null;
  what_you_learn: string | null;
  skills: string[] | null;
  order: number;
  chapters: any[] | null;
  deadline_days: number | null;
  deadline_date: string | null;
};

export function LessonEditor({
  lesson, courseId, prevDeadlineDate, nextDeadlineDate, courseDeadlineDate,
}: {
  lesson: Lesson;
  courseId: string;
  prevDeadlineDate?: string | null;
  nextDeadlineDate?: string | null;
  courseDeadlineDate?: string | null;
}) {
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "");
  const [audioUrl, setAudioUrl] = useState(lesson.audio_url ?? "");
  const [documentUrl, setDocumentUrl] = useState(lesson.document_url ?? "");
  const [slidesUrl, setSlidesUrl] = useState(lesson.slides_url ?? "");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState("");
  const [whatYouLearn, setWhatYouLearn] = useState(lesson.what_you_learn ?? "");
  const [skills, setSkills] = useState<string[]>(lesson.skills ?? [""]);
  const [deadlineDays, setDeadlineDays] = useState(lesson.deadline_days?.toString() ?? "");
  const [deadlineDate, setDeadlineDate] = useState(lesson.deadline_date ?? "");
  const [deadlineMode, setDeadlineMode] = useState<"none" | "days" | "date">(
    lesson.deadline_date ? "date" : lesson.deadline_days ? "days" : "none"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deadlineError, setDeadlineError] = useState("");
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState("");
  // Video source mode: "link" = external URL, "upload" = Supabase Storage path
  const [videoMode, setVideoMode] = useState<"link" | "upload">(
    lesson.video_url && !lesson.video_url.startsWith("http") ? "upload" : "link"
  );
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setDocError("Max file size is 20MB."); return; }
    setUploadingDoc(true);
    setDocError("");
    const supabase = createClient();
    const path = `${lesson.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("lesson-documents").upload(path, file, { upsert: true });
    if (error) { setDocError(error.message); setUploadingDoc(false); return; }
    const { data } = supabase.storage.from("lesson-documents").getPublicUrl(path);
    setDocumentUrl(data.publicUrl);
    await supabase.from("lessons").update({ document_url: data.publicUrl }).eq("id", lesson.id);
    // Auto-extract PDF text for AI coach
    fetch("/api/admin/extract-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentUrl: data.publicUrl, lessonId: lesson.id }),
    }).catch(() => {});
    setUploadingDoc(false);
    router.refresh();
  }

  async function handleGenerateAudio() {
    setGeneratingAudio(true);
    setAudioError("");
    const res = await fetch("/api/ai-builder/audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lesson.id }),
    });
    if (!res.ok) { setAudioError(await res.text()); setGeneratingAudio(false); return; }
    const { audioUrl: url } = await res.json();
    setAudioUrl(url);
    setGeneratingAudio(false);
    router.refresh();
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploadProgress(0);

    const urlRes = await fetch("/api/lessons/video-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lesson.id, filename: file.name }),
    });
    if (!urlRes.ok) { setUploadError(await urlRes.text()); setUploadProgress(null); return; }
    const { signedUrl, path } = await urlRes.json();

    const uploadOk = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status < 300) {
          resolve(true);
        } else {
          let msg = `Upload failed: ${xhr.status}`;
          try { const body = JSON.parse(xhr.responseText); msg = body.message ?? msg; } catch {}
          setUploadError(msg);
          setUploadProgress(null);
          resolve(false);
        }
      };
      xhr.onerror = () => { setUploadError("Network error during upload"); setUploadProgress(null); resolve(false); };
      xhr.send(file);
    });

    if (!uploadOk) return;

    setVideoUrl(path);
    setUploadProgress(null);

    // Persist immediately so the path is saved
    const supabase = createClient();
    await supabase.from("lessons").update({ video_url: path }).eq("id", lesson.id);
    router.refresh();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setDeadlineError("");

    // Validate exact-date deadlines only
    if (deadlineMode === "date" && deadlineDate) {
      if (prevDeadlineDate && deadlineDate <= prevDeadlineDate) {
        setDeadlineError(`Deadline must be after the previous lesson's deadline (${prevDeadlineDate}).`);
        return;
      }
      if (nextDeadlineDate && deadlineDate >= nextDeadlineDate) {
        setDeadlineError(`Deadline must be before the next lesson's deadline (${nextDeadlineDate}).`);
        return;
      }
      if (courseDeadlineDate && deadlineDate > courseDeadlineDate) {
        setDeadlineError(`Deadline cannot be later than the course deadline (${courseDeadlineDate}).`);
        return;
      }
    }

    setSaving(true);

    let duration_seconds: number | null = null;
    if (videoUrl && videoUrl.startsWith("http") && videoUrl.includes("drive.google.com")) {
      const res = await fetch("/api/lessons/video-duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        duration_seconds = data.duration_seconds ?? null;
      }
    }

    const supabase = createClient();
    await supabase
      .from("lessons")
      .update({
        title,
        content,
        video_url: videoUrl || null,
        slides_url: slidesUrl || null,
        document_url: documentUrl || null,
        what_you_learn: whatYouLearn.trim() || null,
        skills: skills.filter((s) => s.trim()),
        deadline_days: deadlineMode === "days" && deadlineDays ? parseInt(deadlineDays) : null,
        deadline_date: deadlineMode === "date" && deadlineDate ? deadlineDate : null,
        ...(duration_seconds !== null ? { duration_seconds } : {}),
      })
      .eq("id", lesson.id);

    // Auto-extract Google Slides/Docs/Sheets text for AI coach
    if (slidesUrl && slidesUrl.includes("docs.google.com")) {
      fetch("/api/admin/extract-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slidesUrl, lessonId: lesson.id }),
      }).catch(() => {});
    }

    // Auto-extract PDF text for AI coach
    if (documentUrl) {
      fetch("/api/admin/extract-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl, lessonId: lesson.id }),
      }).catch(() => {});
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("lessons").delete().eq("id", lesson.id);
    router.push(`/admin/courses/${courseId}`);
  }

  return (
    <>
    {showPreview && <PreviewModal courseId={courseId} lessonId={lesson.id} onClose={() => setShowPreview(false)} />}
    <form onSubmit={handleSave} className="bg-white border rounded-xl p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Lesson title</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <LessonContentEditor value={content} onChange={setContent} />

      {/* Video */}
      <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Video <span className="text-gray-400 font-normal">(optional)</span></p>
          <div className="flex gap-1 bg-white border rounded-lg p-0.5">
            {(["link", "upload"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setVideoMode(m); setVideoUrl(""); setUploadError(""); }}
                className={`text-xs px-3 py-1 rounded-md font-medium transition ${videoMode === m ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
              >
                {m === "link" ? "Paste link" : "Upload file"}
              </button>
            ))}
          </div>
        </div>

        {videoMode === "link" ? (
          <div>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube, Google Drive, or Vimeo URL"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
            <p className="text-xs text-gray-400 mt-1">
              Google Drive: Share → "Anyone with the link" → copy URL
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="cursor-pointer flex items-center gap-3 border-2 border-dashed rounded-lg p-3 hover:bg-white transition bg-white/50">
              <span className="text-xl shrink-0">🎬</span>
              <div className="flex-1 min-w-0">
                {uploadProgress !== null ? (
                  <div>
                    <p className="text-sm font-medium">Uploading… {uploadProgress}%</p>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : videoUrl ? (
                  <p className="text-sm font-medium truncate text-green-700">✓ {videoUrl.split("/").pop()}</p>
                ) : (
                  <div>
                    <p className="text-sm font-medium">Choose video file</p>
                    <p className="text-xs text-gray-400">MP4, MOV, WebM — uploaded directly to private storage</p>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadProgress !== null}
                onChange={handleVideoUpload}
              />
            </label>
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
            {videoUrl && (
              <button
                type="button"
                onClick={() => { setVideoUrl(""); }}
                className="text-xs text-red-400 hover:underline"
              >
                Remove video
              </button>
            )}
          </div>
        )}
      </div>

      {/* Google Slides / Presentation */}
      <div>
        <label className="block text-sm font-medium mb-1">Slides / Presentation URL <span className="text-gray-400">(optional)</span></label>
        <input
          type="url"
          value={slidesUrl}
          onChange={(e) => setSlidesUrl(e.target.value)}
          placeholder="Google Slides, Canva, or any presentation link"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Google Slides: File → Share → Publish to web → Embed → paste the link here
        </p>
        {slidesUrl && slidesUrl.includes("docs.google.com/presentation") && (
          <p className="text-xs text-green-600 mt-1">✓ AI coach will read this presentation on save</p>
        )}
      </div>

      {/* PDF Document */}
      <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
        <div>
          <p className="text-sm font-medium">PDF Document</p>
          <p className="text-xs text-gray-400">Learners view it inline — no download button shown.</p>
        </div>
        <label className="cursor-pointer flex items-center gap-3 border-2 border-dashed rounded-lg p-3 hover:bg-white transition">
          <span className="text-xl shrink-0">📄</span>
          <div>
            <p className="text-sm font-medium">
              {uploadingDoc ? "Uploading…" : documentUrl ? "PDF uploaded — click to replace" : "Upload PDF"}
            </p>
            <p className="text-xs text-gray-400">Max 20MB</p>
          </div>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            disabled={uploadingDoc}
            onChange={handleDocumentUpload}
          />
        </label>
        {docError && <p className="text-xs text-red-500">{docError}</p>}
        {documentUrl && !uploadingDoc && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-600 font-medium">✓ PDF ready for learners</span>
            <button
              type="button"
              onClick={() => setDocumentUrl("")}
              className="text-xs text-red-400 hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Module preview info */}
      <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
        <p className="text-sm font-semibold">Module preview <span className="text-gray-400 font-normal">(shown on course page)</span></p>
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600">What learners will learn in this module</label>
          <textarea
            value={whatYouLearn}
            onChange={(e) => setWhatYouLearn(e.target.value)}
            rows={2}
            placeholder="Brief description of what this module covers…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-2 text-gray-600">Skills gained</label>
          <div className="space-y-2">
            {skills.map((skill, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => {
                    const next = [...skills];
                    next[i] = e.target.value;
                    setSkills(next);
                  }}
                  placeholder={`Skill ${i + 1}`}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {skills.length > 1 && (
                  <button type="button" onClick={() => setSkills(skills.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setSkills([...skills, ""])} className="text-xs text-brand-600 hover:underline">
              + Add skill
            </button>
          </div>
        </div>
      </div>

      {/* Video chapters */}
      <ChaptersEditor lessonId={lesson.id} initial={lesson.chapters ?? []} />

      {/* Lesson deadline */}
      <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
        <div>
          <p className="text-sm font-medium">Completion deadline <span className="text-gray-400 font-normal">(optional)</span></p>
          <p className="text-xs text-gray-400">Learners see an overdue badge if they miss this deadline.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["none", "days", "date"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDeadlineMode(m)}
              className={`text-xs px-3 py-1.5 rounded-full border ${deadlineMode === m ? "bg-brand-600 text-white border-brand-600" : "text-gray-600 border-gray-300 hover:bg-gray-50"}`}
            >
              {m === "none" ? "No deadline" : m === "days" ? "Days after enrollment" : "Exact date"}
            </button>
          ))}
        </div>
        {deadlineMode === "days" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="365"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              placeholder="e.g. 7"
              className="w-24 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-500">days after enrollment</span>
          </div>
        )}
        {deadlineMode === "date" && (
          <div className="space-y-1">
            <input
              type="date"
              value={deadlineDate}
              min={prevDeadlineDate ?? undefined}
              max={courseDeadlineDate ?? undefined}
              onChange={(e) => { setDeadlineDate(e.target.value); setDeadlineError(""); }}
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {prevDeadlineDate && <p className="text-xs text-gray-400">Must be after previous lesson: {prevDeadlineDate}</p>}
            {nextDeadlineDate && <p className="text-xs text-gray-400">Must be before next lesson: {nextDeadlineDate}</p>}
            {courseDeadlineDate && <p className="text-xs text-gray-400">Course deadline: {courseDeadlineDate}</p>}
          </div>
        )}
        {deadlineError && <p className="text-xs text-red-500 font-medium">{deadlineError}</p>}
      </div>

      {/* Audio narration */}
      <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Audio narration</p>
            <p className="text-xs text-gray-400">AI-generated voice narration of this lesson's content.</p>
          </div>
          <button
            type="button"
            onClick={handleGenerateAudio}
            disabled={generatingAudio}
            className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium shrink-0"
          >
            {generatingAudio ? "Generating…" : audioUrl ? "Regenerate" : "Generate audio"}
          </button>
        </div>
        {audioError && <p className="text-xs text-red-500">{audioError}</p>}
        {audioUrl && !generatingAudio && (
          <audio controls className="w-full h-10" src={audioUrl} />
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={handleDelete} className="text-sm text-red-500 hover:underline">
          Delete lesson
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium"
          >
            Preview
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
    </>
  );
}
