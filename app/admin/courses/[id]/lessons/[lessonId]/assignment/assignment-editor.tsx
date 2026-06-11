"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LessonContentEditor } from "@/components/lesson-content-editor";

type RubricItem = { criterion: string; description: string; max_points: number };
type Assignment = {
  id: string; title: string; instructions: string; rubric: RubricItem[];
  is_group_assignment?: boolean; template_url?: string | null;
} | null;

export function AssignmentEditor({
  lessonId,
  existing,
}: {
  lessonId: string;
  existing: Assignment;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [rubric, setRubric] = useState<RubricItem[]>(
    existing?.rubric ?? [{ criterion: "", description: "", max_points: 10 }]
  );
  const [isGroupAssignment, setIsGroupAssignment] = useState(existing?.is_group_assignment ?? false);
  const [templateUrl, setTemplateUrl] = useState(existing?.template_url ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genWarnings, setGenWarnings] = useState<string[]>([]);

  // Source selection
  const [sources, setSources] = useState({ content: true, slides: true, uploads: true });
  const [useAdHoc, setUseAdHoc] = useState(false);
  const [adHocFiles, setAdHocFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allPersistentSources = sources.content && sources.slides && sources.uploads;

  function toggleAllSources(checked: boolean) {
    setSources({ content: checked, slides: checked, uploads: checked });
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const allowed = Array.from(incoming).filter((f) =>
      /\.(pdf|docx?|txt)$/i.test(f.name)
    );
    setAdHocFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...allowed.filter((f) => !names.has(f.name))].slice(0, 5);
    });
  }

  function removeFile(name: string) {
    setAdHocFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function addCriterion() {
    setRubric([...rubric, { criterion: "", description: "", max_points: 10 }]);
  }

  function removeCriterion(i: number) {
    setRubric(rubric.filter((_, idx) => idx !== i));
  }

  function updateCriterion(i: number, field: keyof RubricItem, value: string | number) {
    const updated = [...rubric];
    (updated[i] as any)[field] = value;
    setRubric(updated);
  }

  const totalPoints = rubric.reduce((s, r) => s + Number(r.max_points), 0);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setGenWarnings([]);

    // Extract ad-hoc files first if needed
    let adHocText = "";
    if (useAdHoc && adHocFiles.length > 0) {
      const fd = new FormData();
      adHocFiles.forEach((f) => fd.append("files", f));
      const extractRes = await fetch("/api/extract-upload", { method: "POST", body: fd });
      if (!extractRes.ok) {
        setError(await extractRes.text());
        setGenerating(false);
        return;
      }
      const { results } = await extractRes.json();
      adHocText = (results as Array<{ name: string; text: string }>)
        .map((r) => `### ${r.name}\n${r.text}`)
        .join("\n\n");
    }

    const res = await fetch("/api/assignments/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, sources, adHocText: adHocText || undefined }),
    });
    if (!res.ok) {
      setError("AI generation failed. Try again.");
      setGenerating(false);
      return;
    }
    const data = await res.json();
    if (data.title) setTitle(data.title);
    if (data.instructions) setInstructions(data.instructions);
    if (Array.isArray(data.rubric) && data.rubric.length > 0) setRubric(data.rubric);
    if (data.warnings?.length) setGenWarnings(data.warnings);
    setGenerating(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/assignments/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: existing?.id,
        lesson_id: lessonId,
        title,
        instructions,
        rubric,
        is_group_assignment: isGroupAssignment,
        template_url: templateUrl.trim() || null,
      }),
    });

    if (!res.ok) {
      setError(await res.text());
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!existing || !confirm("Delete this assignment?")) return;
    await fetch("/api/assignments/save", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: existing.id }),
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-gray-700">Assignment details</h3>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 text-sm border border-purple-300 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-50 disabled:opacity-50 font-medium"
          >
            {generating ? (
              <>
                <span className="animate-spin text-base">⟳</span> Generating…
              </>
            ) : (
              <>✦ Generate with AI</>
            )}
          </button>
        </div>

        {/* Source selection */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2.5">
          <p className="text-xs font-medium text-purple-800">Generate assignment from:</p>

          {/* All lesson materials master toggle */}
          <label className="flex items-center gap-2 text-xs text-purple-900 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={allPersistentSources}
              onChange={(e) => toggleAllSources(e.target.checked)}
              className="w-4 h-4"
            />
            Use all lesson materials
          </label>

          {/* Individual sources */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 ml-1">
            <label className="flex items-center gap-2 text-xs text-purple-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sources.slides}
                onChange={(e) => setSources({ ...sources, slides: e.target.checked })}
                className="w-4 h-4"
              />
              Use Slides
            </label>
            <label className="flex items-center gap-2 text-xs text-purple-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sources.content}
                onChange={(e) => setSources({ ...sources, content: e.target.checked })}
                className="w-4 h-4"
              />
              Use Content Section
            </label>
            <label className="flex items-center gap-2 text-xs text-purple-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sources.uploads}
                onChange={(e) => setSources({ ...sources, uploads: e.target.checked })}
                className="w-4 h-4"
              />
              Use uploaded materials
            </label>
            <label className="flex items-center gap-2 text-xs text-purple-700 cursor-pointer">
              <input
                type="checkbox"
                checked={useAdHoc}
                onChange={(e) => setUseAdHoc(e.target.checked)}
                className="w-4 h-4"
              />
              Upload materials
            </label>
          </div>

          {/* Ad-hoc file upload area */}
          {useAdHoc && (
            <div className="mt-1 ml-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              {adHocFiles.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-purple-300 rounded-lg py-4 text-xs text-purple-600 hover:bg-purple-100 transition-colors"
                >
                  Click to select files (PDF, DOCX, DOC, TXT — up to 5 files, 10 MB each)
                </button>
              ) : (
                <div className="space-y-1.5">
                  {adHocFiles.map((f) => (
                    <div key={f.name} className="flex items-center justify-between bg-white border border-purple-200 rounded-lg px-3 py-2">
                      <span className="text-xs text-purple-800 truncate max-w-xs">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(f.name)}
                        className="text-purple-400 hover:text-red-500 text-sm ml-3 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {adHocFiles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      + Add more files
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {generating && (
          <p className="text-xs text-purple-600 animate-pulse">Reading the selected lesson materials…</p>
        )}
        {genWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-amber-800">⚠ Some content sources could not be read:</p>
            {genWarnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700">• {w}</p>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Assignment title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reflection Essay"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Instructions for learner</label>
          <LessonContentEditor value={instructions} onChange={setInstructions} />
        </div>
      </div>

      {/* Assignment type + template */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="font-medium text-sm text-gray-700">Assignment options</h3>

        {/* Group assignment toggle */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={isGroupAssignment}
              onChange={(e) => setIsGroupAssignment(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-brand-600 transition-colors" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-all peer-checked:translate-x-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Group assignment</p>
            <p className="text-xs text-gray-500 mt-0.5">
              One person submits on behalf of their group. When approved, the score is applied to every group member.
            </p>
          </div>
        </label>

        {/* Google Docs / Slides template */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Google Docs / Slides template URL <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="url"
            value={templateUrl}
            onChange={(e) => setTemplateUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Learners will see a "Copy template" button that opens Google's native copy flow.
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium text-sm">Rubric</h3>
            <p className="text-xs text-gray-400">Total: {totalPoints} points</p>
          </div>
          <button type="button" onClick={addCriterion} className="text-sm text-brand-600 hover:underline">
            + Add criterion
          </button>
        </div>

        <div className="space-y-3">
          {rubric.map((item, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={item.criterion}
                  onChange={(e) => updateCriterion(i, "criterion", e.target.value)}
                  placeholder="Criterion name (e.g. Analysis)"
                  className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={item.max_points}
                    onChange={(e) => updateCriterion(i, "max_points", Number(e.target.value))}
                    className="w-16 border rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-xs text-gray-400">pts</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCriterion(i)}
                  disabled={rubric.length === 1}
                  className="text-red-400 hover:text-red-600 disabled:opacity-20 text-sm"
                >
                  ✕
                </button>
              </div>
              <input
                value={item.description}
                onChange={(e) => updateCriterion(i, "description", e.target.value)}
                placeholder="What does full marks look like?"
                className="w-full border rounded px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center justify-between">
        {existing ? (
          <button type="button" onClick={handleDelete} className="text-sm text-red-500 hover:underline">
            Delete assignment
          </button>
        ) : <div />}
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : existing ? "Save changes" : "Create assignment"}
        </button>
      </div>
    </form>
  );
}
