"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Question = { question: string; options: string[]; correct: number };
type ChapterRaw = { id: string; title: string; start: number; end: number; questions?: Question[] };
type Chapter = { id: string; title: string; start: number; end: number; questions: Question[] };

function toTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function toSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0);
  return 0;
}

export function ChaptersEditor({ lessonId, initial }: { lessonId: string; initial: ChapterRaw[] | null }) {
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>(
    (initial ?? []).map((ch) => ({ ...ch, questions: ch.questions ?? [] }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);

  function addChapter() {
    const lastEnd = chapters[chapters.length - 1]?.end ?? 0;
    setChapters([...chapters, { id: crypto.randomUUID(), title: "", start: lastEnd, end: lastEnd + 300, questions: [] }]);
  }

  function remove(id: string) {
    setChapters(chapters.filter((c) => c.id !== id));
  }

  function update(id: string, field: keyof Chapter, value: any) {
    setChapters(chapters.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function move(i: number, dir: -1 | 1) {
    const arr = [...chapters];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setChapters(arr);
  }

  function addQ(cid: string) {
    setChapters(chapters.map((c) =>
      c.id === cid ? { ...c, questions: [...c.questions, { question: "", options: ["", "", "", ""], correct: 0 }] } : c
    ));
  }

  function removeQ(cid: string, qi: number) {
    setChapters(chapters.map((c) =>
      c.id === cid ? { ...c, questions: c.questions.filter((_, i) => i !== qi) } : c
    ));
  }

  function updateQ(cid: string, qi: number, field: keyof Question, value: any) {
    setChapters(chapters.map((c) => {
      if (c.id !== cid) return c;
      const qs = [...c.questions];
      (qs[qi] as any)[field] = value;
      return { ...c, questions: qs };
    }));
  }

  function updateOpt(cid: string, qi: number, oi: number, value: string) {
    setChapters(chapters.map((c) => {
      if (c.id !== cid) return c;
      const qs = c.questions.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q
      );
      return { ...c, questions: qs };
    }));
  }

  async function save() {
    setSaving(true);
    setSaveError("");
    const res = await fetch("/api/lessons/chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, chapters }),
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(`Save failed: ${await res.text()}`);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Video chapters</p>
          <p className="text-xs text-gray-400">Split the video into named segments. Each can have its own quiz.</p>
        </div>
        <button type="button" onClick={save} disabled={saving}
          className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save chapters"}
        </button>
      </div>
      {saveError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}

      {chapters.map((ch, i) => (
        <div key={ch.id} className="bg-white border rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1 mt-1 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === chapters.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs">▼</button>
            </div>
            <div className="flex-1 space-y-2">
              <input type="text" value={ch.title}
                onChange={(e) => update(ch.id, "title", e.target.value)}
                placeholder={`Chapter ${i + 1} title`}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-gray-500">Start</label>
                  <input type="text" value={toTime(ch.start)}
                    onChange={(e) => update(ch.id, "start", toSeconds(e.target.value))}
                    placeholder="0:00" className="w-20 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-gray-500">End</label>
                  <input type="text" value={toTime(ch.end)}
                    onChange={(e) => update(ch.id, "end", toSeconds(e.target.value))}
                    placeholder="5:00" className="w-20 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <button type="button" onClick={() => remove(ch.id)} className="ml-auto text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
            </div>
          </div>

          {/* Per-chapter quiz */}
          <div className="border-t pt-3 space-y-2">
            <button type="button" onClick={() => setOpenQuiz(openQuiz === ch.id ? null : ch.id)}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1">
              {ch.questions.length > 0 ? `📝 Quiz (${ch.questions.length})` : "📝 Add quiz"}
              <span>{openQuiz === ch.id ? "▲" : "▼"}</span>
            </button>

            {openQuiz === ch.id && (
              <div className="space-y-3 pt-1">
                {ch.questions.map((q, qi) => (
                  <div key={qi} className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <input type="text" value={q.question}
                        onChange={(e) => updateQ(ch.id, qi, "question", e.target.value)}
                        placeholder="Question" className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button type="button" onClick={() => removeQ(ch.id, qi)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
                    </div>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" name={`ch-${ch.id}-q${qi}`} checked={q.correct === oi}
                          onChange={() => updateQ(ch.id, qi, "correct", oi)} className="shrink-0" />
                        <input type="text" value={opt}
                          onChange={(e) => updateOpt(ch.id, qi, oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`}
                          className={`flex-1 border rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 ${q.correct === oi ? "border-green-400 bg-green-50" : ""}`}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <button type="button" onClick={() => addQ(ch.id)} className="text-xs text-brand-600 hover:underline">
                  + Add question manually
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={addChapter}
        className="w-full text-sm border-2 border-dashed rounded-xl px-4 py-3 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition">
        + Add chapter
      </button>
    </div>
  );
}
