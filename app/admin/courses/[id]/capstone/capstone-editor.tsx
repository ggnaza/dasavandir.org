"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type RubricItem = { criterion: string; description: string; max_points: number };
type Capstone = { id: string; title: string; instructions: string; rubric: RubricItem[] } | null;

export function CapstoneEditor({ courseId, existing }: { courseId: string; existing: Capstone }) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [rubric, setRubric] = useState<RubricItem[]>(
    existing?.rubric ?? [{ criterion: "", description: "", max_points: 10 }]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/capstones/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: existing?.id, course_id: courseId, title, instructions, rubric }),
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
    if (!existing || !confirm("Delete this capstone project?")) return;
    await fetch("/api/capstones/save", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: existing.id }),
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Project title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Final Capstone Project"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Instructions for learner</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder="Describe the project, what learners should demonstrate, and how to submit…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
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
            Delete capstone
          </button>
        ) : <div />}
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : existing ? "Save changes" : "Create capstone"}
        </button>
      </div>
    </form>
  );
}
