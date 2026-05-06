"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type GeneratedLesson = {
  title: string;
  content: string;
  what_you_learn: string;
  slides_outline: string;
  video_script: string;
  include: boolean;
  expanded: { content: boolean; slides: boolean; script: boolean };
};

type GeneratedCourse = {
  title: string;
  description: string;
  outcomes: string[];
  lessons: GeneratedLesson[];
  materialUrl: string | null;
};

const LOADING_MESSAGES = [
  "Reading your materials…",
  "Identifying key topics…",
  "Designing lesson structure…",
  "Writing lesson content…",
  "Creating slide outlines…",
  "Writing video scripts…",
  "Putting it all together…",
];

export default function GenerateCoursePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"input" | "loading" | "preview" | "creating">("input");

  // Input state
  const [hint, setHint] = useState("");
  const [language, setLanguage] = useState<"en" | "hy">("hy");
  const [inputMode, setInputMode] = useState<"url" | "file">("url");
  const [materialUrl, setMaterialUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  // Loading state
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  // Preview state
  const [course, setCourse] = useState<GeneratedCourse | null>(null);

  // Cycle loading messages
  useEffect(() => {
    if (step !== "loading") return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [step]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep("loading");
    setLoadingMsgIndex(0);

    const form = new FormData();
    form.append("language", language);
    form.append("hint", hint);
    if (inputMode === "url") {
      form.append("materialUrl", materialUrl);
    } else if (file) {
      form.append("file", file);
    }

    try {
      const res = await fetch("/api/admin/courses/generate", { method: "POST", body: form });
      if (!res.ok) {
        const msg = await res.text();
        setError(msg || "Generation failed. Please try again.");
        setStep("input");
        return;
      }
      const data = await res.json();
      setCourse({
        title: data.title ?? "",
        description: data.description ?? "",
        outcomes: data.outcomes ?? [],
        materialUrl: data.materialUrl ?? null,
        lessons: (data.lessons ?? []).map((l: any) => ({
          title: l.title ?? "",
          content: l.content ?? "",
          what_you_learn: l.what_you_learn ?? "",
          slides_outline: l.slides_outline ?? "",
          video_script: l.video_script ?? "",
          include: true,
          expanded: { content: false, slides: false, script: false },
        })),
      });
      setStep("preview");
    } catch {
      setError("Network error. Please try again.");
      setStep("input");
    }
  }

  async function handleCreate() {
    if (!course) return;
    setStep("creating");

    const lessons = course.lessons.filter((l) => l.include).map((l) => ({
      title: l.title,
      content: l.content,
      what_you_learn: l.what_you_learn,
      slides_outline: l.slides_outline,
      video_script: l.video_script,
    }));

    try {
      const res = await fetch("/api/admin/courses/generate-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.title,
          description: course.description,
          outcomes: course.outcomes,
          language,
          materialUrl: course.materialUrl,
          lessons,
        }),
      });

      if (!res.ok) {
        setError(await res.text());
        setStep("preview");
        return;
      }

      const { courseId } = await res.json();
      router.push(`/admin/courses/${courseId}`);
    } catch {
      setError("Failed to create course. Please try again.");
      setStep("preview");
    }
  }

  function updateLesson(i: number, patch: Partial<GeneratedLesson>) {
    if (!course) return;
    const lessons = [...course.lessons];
    lessons[i] = { ...lessons[i], ...patch };
    setCourse({ ...course, lessons });
  }

  function toggleExpand(i: number, key: "content" | "slides" | "script") {
    if (!course) return;
    const lessons = [...course.lessons];
    lessons[i] = {
      ...lessons[i],
      expanded: { ...lessons[i].expanded, [key]: !lessons[i].expanded[key] },
    };
    setCourse({ ...course, lessons });
  }

  // ── Step: Input ──────────────────────────────────────────────────────────
  if (step === "input") {
    return (
      <div className="max-w-xl">
        <div className="mb-6">
          <Link href="/admin/courses/new" className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
          <h1 className="text-2xl font-bold mt-2">Generate course with AI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Provide your learning material — a Google Doc, Google Slides, or a PDF — and AI will design the full course structure, lesson content, slide outlines, and video scripts.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="bg-white border rounded-xl p-6 space-y-5">
          {/* Hint */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Course topic hint <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="e.g. Leadership for first-time managers"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">Helps the AI focus if your material covers a broad topic.</p>
          </div>

          {/* Material input mode */}
          <div>
            <label className="block text-sm font-medium mb-2">Learning material</label>
            <div className="flex gap-2 mb-3">
              {(["url", "file"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInputMode(mode)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${inputMode === mode ? "bg-brand-600 text-white border-brand-600" : "text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                >
                  {mode === "url" ? "Google Drive link" : "Upload PDF"}
                </button>
              ))}
            </div>

            {inputMode === "url" && (
              <div>
                <input
                  type="url"
                  required
                  value={materialUrl}
                  onChange={(e) => setMaterialUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Google Docs or Google Slides. Make sure sharing is "Anyone with the link can view".
                </p>
              </div>
            )}

            {inputMode === "file" && (
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg font-medium">
                  {file ? file.name : "Choose PDF file"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    required
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-1">PDF · max 20MB.</p>
              </div>
            )}
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium mb-2">Generate content in</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={language === "hy"} onChange={() => setLanguage("hy")} className="w-4 h-4" />
                <span className="text-sm">Հայերեն (Armenian)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={language === "en"} onChange={() => setLanguage("en")} className="w-4 h-4" />
                <span className="text-sm">English</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg hover:bg-brand-700 font-medium flex items-center justify-center gap-2"
          >
            <span>✦</span> Generate course
          </button>
        </form>
      </div>
    );
  }

  // ── Step: Loading ────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mt-2">Generating your course…</h1>
          <p className="text-sm text-gray-500 mt-1">This usually takes 30–60 seconds. Don't close this tab.</p>
        </div>
        <div className="bg-white border rounded-xl p-10 flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-600 font-medium min-h-[20px]">
            {LOADING_MESSAGES[loadingMsgIndex]}
          </p>
          <div className="text-xs text-gray-400 text-center max-w-xs">
            AI is reading your materials, structuring lessons, writing content, slide outlines, and video scripts.
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Creating ───────────────────────────────────────────────────────
  if (step === "creating") {
    return (
      <div className="max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mt-2">Creating course…</h1>
        </div>
        <div className="bg-white border rounded-xl p-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Setting up your course and lessons…</p>
        </div>
      </div>
    );
  }

  // ── Step: Preview ────────────────────────────────────────────────────────
  if (!course) return null;
  const includedCount = course.lessons.filter((l) => l.include).length;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <button onClick={() => setStep("input")} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-2xl font-bold mt-2">Review generated course</h1>
        <p className="text-sm text-gray-500 mt-1">
          Edit titles and content, expand sections to review or copy slide outlines and video scripts, then create the course.
        </p>
      </div>

      <div className="space-y-5">
        {/* Course meta */}
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Course title</label>
            <input
              type="text"
              value={course.title}
              onChange={(e) => setCourse({ ...course, title: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              value={course.description}
              onChange={(e) => setCourse({ ...course, description: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {course.outcomes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Outcomes</label>
              <ul className="space-y-1">
                {course.outcomes.map((o, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-brand-500 text-xs">✓</span>
                    <input
                      type="text"
                      value={o}
                      onChange={(e) => {
                        const next = [...course.outcomes];
                        next[i] = e.target.value;
                        setCourse({ ...course, outcomes: next });
                      }}
                      className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Lessons */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Lessons <span className="text-gray-400 font-normal">({includedCount} selected)</span>
          </h2>
          <div className="space-y-3">
            {course.lessons.map((lesson, i) => (
              <div
                key={i}
                className={`bg-white border rounded-xl overflow-hidden ${!lesson.include ? "opacity-50" : ""}`}
              >
                {/* Lesson header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b">
                  <input
                    type="checkbox"
                    checked={lesson.include}
                    onChange={(e) => updateLesson(i, { include: e.target.checked })}
                    className="w-4 h-4 shrink-0"
                  />
                  <span className="text-xs text-gray-400 shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={lesson.title}
                    onChange={(e) => updateLesson(i, { title: e.target.value })}
                    disabled={!lesson.include}
                    className="flex-1 text-sm font-medium border-0 focus:outline-none focus:ring-0 bg-transparent"
                  />
                </div>

                {lesson.include && (
                  <div className="divide-y">
                    {/* Content */}
                    <ExpandSection
                      label="Lesson content"
                      expanded={lesson.expanded.content}
                      onToggle={() => toggleExpand(i, "content")}
                      preview={lesson.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)}
                    >
                      <textarea
                        value={lesson.content}
                        onChange={(e) => updateLesson(i, { content: e.target.value })}
                        rows={8}
                        className="w-full text-xs font-mono border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
                      />
                      <p className="text-xs text-gray-400 mt-1">HTML content — editable. This becomes the lesson body.</p>
                    </ExpandSection>

                    {/* Slides */}
                    <ExpandSection
                      label="Slide outline"
                      badge="copy to use in Google Slides"
                      expanded={lesson.expanded.slides}
                      onToggle={() => toggleExpand(i, "slides")}
                      preview={lesson.slides_outline.split("\n")[0] ?? ""}
                    >
                      <textarea
                        value={lesson.slides_outline}
                        onChange={(e) => updateLesson(i, { slides_outline: e.target.value })}
                        rows={6}
                        className="w-full text-xs font-mono border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
                      />
                      <CopyButton text={lesson.slides_outline} />
                    </ExpandSection>

                    {/* Video script */}
                    <ExpandSection
                      label="Video script"
                      badge="record or paste into TTS"
                      expanded={lesson.expanded.script}
                      onToggle={() => toggleExpand(i, "script")}
                      preview={lesson.video_script.slice(0, 120)}
                    >
                      <textarea
                        value={lesson.video_script}
                        onChange={(e) => updateLesson(i, { video_script: e.target.value })}
                        rows={6}
                        className="w-full text-xs font-mono border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
                      />
                      <CopyButton text={lesson.video_script} />
                    </ExpandSection>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button onClick={() => setStep("input")} className="text-sm text-gray-500 hover:underline">
            ← Start over
          </button>
          <button
            onClick={handleCreate}
            disabled={includedCount === 0}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            Create course with {includedCount} lesson{includedCount !== 1 ? "s" : ""} →
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpandSection({
  label,
  badge,
  expanded,
  onToggle,
  preview,
  children,
}: {
  label: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left gap-2"
      >
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          {badge && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{badge}</span>
          )}
        </span>
        <span className="text-gray-400 text-xs shrink-0">{expanded ? "▲ collapse" : "▼ expand"}</span>
      </button>
      {!expanded && preview && (
        <p className="text-xs text-gray-400 mt-1 truncate">{preview}…</p>
      )}
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="mt-1.5 text-xs text-brand-600 hover:underline"
    >
      {copied ? "Copied ✓" : "Copy to clipboard"}
    </button>
  );
}
