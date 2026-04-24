"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LessonContentEditor } from "@/components/lesson-content-editor-dynamic";

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
};

export function LessonEditor({ lesson, courseId }: { lesson: Lesson; courseId: string }) {
  const router = useRouter();
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState("");

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
    // Auto-save the document URL
    await supabase.from("lessons").update({ document_url: data.publicUrl }).eq("id", lesson.id);
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
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
      })
      .eq("id", lesson.id);
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
      <div>
        <label className="block text-sm font-medium mb-1">Video URL <span className="text-gray-400">(optional)</span></label>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="YouTube, Vimeo, or Google Drive share link"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Google Drive: open the file → Share → copy link (must be "Anyone with the link")
        </p>
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
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
