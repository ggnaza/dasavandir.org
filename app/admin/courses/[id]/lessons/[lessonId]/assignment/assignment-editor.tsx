"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LessonContentEditor } from "@/components/lesson-content-editor";

type RubricItem = { criterion: string; description: string; max_points: number };
type Assignment = { id: string; title: string; instructions: string; rubric: RubricItem[] } | null;

export function AssignmentEditor({
  lessonId,
  existing,
  lessonTitle,
  lessonContent,
}: {
  lessonId: string;
  existing: Assignment;
  lessonTitle: string;
  lessonContent: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [rubric, setRubric] = useState<RubricItem[]>(
    existing?.rubric ?? [{ criterion: "", description: "", max_points: 10 }]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

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
    const res = await fetch("/api/assignments/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonTitle, lessonContent }),
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
