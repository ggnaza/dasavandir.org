"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DriveBrowser } from "./drive-browser";

type Question = { question: string; options: string[]; correct: number };
type Lesson = { title: string; content: string; quiz: { questions: Question[] }; enabled: boolean };
type Course = { title: string; description: string; lessons: Lesson[] };
type Step = "input" | "review" | "done";
type Source = "text" | "drive";

interface Props {
  driveConnected: boolean;
  justConnected: boolean;
  driveError: boolean;
}

export function AiBuilderClient({ driveConnected, justConnected, driveError }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("input");
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [course, setCourse] = useState<Course | null>(null);
  const [courseId, setCourseId] = useState("");
  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);

  async function handleGenerate(overrideText?: string) {
    const content = overrideText ?? text;
    if (!content.trim() && !file) {
      setError("Please paste content, upload a file, or select files from Google Drive.");
      return;
    }
    setGenerating(true);
    setError("");

    const form = new FormData();
    if (file && !overrideText) form.append("file", file);
    else form.append("text", content);

    const res = await fetch("/api/ai-builder/generate", { method: "POST", body: form });

    if (!res.ok) {
      setError(await res.text());
      setGenerating(false);
      return;
    }

    const data = await res.json();
    setCourse({ ...data, lessons: data.lessons.map((l: Lesson) => ({ ...l, enabled: true })) });
    setStep("review");
    setGenerating(false);
  }

  function handleDriveExtract(extractedText: string) {
    setText(extractedText);
    handleGenerate(extractedText);
  }

  async function handleSave() {
    if (!course) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/ai-builder/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: course.title,
        description: course.description,
        lessons: course.lessons.filter((l) => l.enabled),
      }),
    });

    if (!res.ok) { setError(await res.text()); setSaving(false); return; }
    const { courseId } = await res.json();
    setCourseId(courseId);
    setStep("done");
    setSaving(false);
  }

  function updateLesson(i: number, field: keyof Lesson, value: any) {
    if (!course) return;
    const updated = [...course.lessons];
    (updated[i] as any)[field] = value;
    setCourse({ ...course, lessons: updated });
  }

  // ── STEP 1: Input ──────────────────────────────────────────
  if (step === "input") {
    return (
      <div className="max-w-2xl">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
        <h1 className="text-2xl font-bold mt-2 mb-1">AI Course Builder</h1>
        <p className="text-gray-500 text-sm mb-6">Generate a full course with lessons and quizzes from your materials.</p>

        {/* Source tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSource("text")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${source === "text" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            ✍️ Paste / Upload
          </button>
          <button
            onClick={() => setSource("drive")}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${source === "drive" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            📁 Google Drive
          </button>
        </div>

        {justConnected && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
            ✓ Google Drive connected — select files below to generate a course.
          </div>
        )}
        {driveError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            Google Drive connection failed. Please try again.
          </div>
        )}

        <div className="bg-white border rounded-xl p-6 space-y-4">
          {source === "text" ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Paste your content</label>
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setFile(null); }}
                  rows={12}
                  placeholder="Paste your training material, article, notes, syllabus, or any text here…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t" />
                <span className="text-xs text-gray-400">or upload a file</span>
                <div className="flex-1 border-t" />
              </div>

              <div>
                <label className="cursor-pointer flex items-center gap-3 border-2 border-dashed rounded-lg p-4 hover:bg-gray-50 transition">
                  <span className="text-2xl">📄</span>
                  <div>
                    <p className="text-sm font-medium">{file ? file.name : "Upload file"}</p>
                    <p className="text-xs text-gray-400">PDF or TXT, max 10MB</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={(e) => { setFile(e.target.files?.[0] ?? null); setText(""); }}
                  />
                </label>
                {file && (
                  <button onClick={() => setFile(null)} className="text-xs text-red-500 mt-1 hover:underline">Remove file</button>
                )}
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                onClick={() => handleGenerate()}
                disabled={generating || (!text.trim() && !file)}
                className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
              >
                {generating ? "Generating course… (this takes ~30 seconds)" : "✦ Generate Course with AI"}
              </button>
            </>
          ) : (
            <>
              {!driveConnected ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">📁</p>
                  <p className="text-sm text-gray-600 mb-4">Connect your Google Drive to import documents and generate a course from them.</p>
                  <a
                    href="/api/drive/auth"
                    className="inline-block bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 font-medium text-sm"
                  >
                    Connect Google Drive
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Select files to generate from</p>
                    <a href="/api/drive/auth" className="text-xs text-gray-400 hover:underline">Reconnect</a>
                  </div>
                  <DriveBrowser onExtract={handleDriveExtract} />
                  {generating && (
                    <p className="text-sm text-center text-brand-600 animate-pulse mt-3">
                      Generating course from your Drive files… (~30 seconds)
                    </p>
                  )}
                  {error && <p className="text-red-600 text-sm">{error}</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── STEP 2: Review ─────────────────────────────────────────
  if (step === "review" && course) {
    const activeCount = course.lessons.filter((l) => l.enabled).length;
    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => setStep("input")} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
            <h1 className="text-2xl font-bold mt-1">Review Generated Course</h1>
            <p className="text-sm text-gray-500 mt-0.5">Edit anything before creating. Toggle lessons off to exclude them.</p>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5 mb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Course Title</label>
            <input
              value={course.title}
              onChange={(e) => setCourse({ ...course, title: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
            <textarea
              value={course.description}
              onChange={(e) => setCourse({ ...course, description: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <h2 className="font-semibold mb-2 text-sm text-gray-500 uppercase tracking-wide">
          Lessons ({activeCount} of {course.lessons.length} selected)
        </h2>

        <div className="space-y-3 mb-6">
          {course.lessons.map((lesson, i) => (
            <div key={i} className={`bg-white border rounded-xl overflow-hidden ${!lesson.enabled ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={lesson.enabled}
                  onChange={(e) => updateLesson(i, "enabled", e.target.checked)}
                  className="w-4 h-4 shrink-0"
                />
                <input
                  value={lesson.title}
                  onChange={(e) => updateLesson(i, "title", e.target.value)}
                  className="flex-1 text-sm font-medium border-0 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1"
                />
                <span className="text-xs text-gray-400 shrink-0">{lesson.quiz?.questions?.length ?? 0} quiz questions</span>
                <button
                  onClick={() => setExpandedLesson(expandedLesson === i ? null : i)}
                  className="text-xs text-brand-600 hover:underline shrink-0"
                >
                  {expandedLesson === i ? "Hide" : "Preview"}
                </button>
              </div>
              {expandedLesson === i && (
                <div className="border-t px-4 py-3 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Content preview</label>
                    <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: lesson.content }} />
                  </div>
                  {lesson.quiz?.questions?.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Quiz questions</label>
                      <ul className="text-xs space-y-1">
                        {lesson.quiz.questions.map((q, qi) => (
                          <li key={qi} className="text-gray-600">• {q.question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={() => setStep("input")} className="flex-1 border rounded-lg py-2 text-sm hover:bg-gray-50">
            ← Regenerate
          </button>
          <button
            onClick={handleSave}
            disabled={saving || activeCount === 0}
            className="flex-1 bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? "Creating course…" : `Create course (${activeCount} lessons)`}
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 3: Done ───────────────────────────────────────────
  return (
    <div className="max-w-2xl text-center py-16">
      <div className="text-5xl mb-4">✓</div>
      <h1 className="text-2xl font-bold mb-2">Course created!</h1>
      <p className="text-gray-500 text-sm mb-8">Review and edit the course, then publish when ready.</p>
      <div className="flex gap-3 justify-center">
        <Link href={`/admin/courses/${courseId}`} className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 font-medium">
          Open course →
        </Link>
        <button
          onClick={() => { setStep("input"); setText(""); setFile(null); setCourse(null); }}
          className="border px-6 py-2.5 rounded-lg hover:bg-gray-50"
        >
          Build another
        </button>
      </div>
    </div>
  );
}
