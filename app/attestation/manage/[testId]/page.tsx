"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RichText } from "@/components/attestation/rich-text";
import { QuestionEditor, EMPTY_QUESTION, type EditableQuestion } from "@/components/attestation/question-editor";
import { KeyImporter } from "@/components/attestation/key-importer";
import { formatCorrect, validateCorrect } from "@/lib/attestation-core";
import type { PassageRow, QuestionRow, TestRow } from "@/lib/attestation/server";

interface Loaded {
  test: TestRow;
  passages: PassageRow[];
  questions: QuestionRow[];
  figures: Record<string, string>;
  blockers: string[];
}

const TYPE_SHORT: Record<string, string> = {
  single: "single",
  multi: "multi",
  order: "order",
  match: "match",
  numeric: "number",
  short_text: "text",
};

export default function EditTestPage({ params }: { params: { testId: string } }) {
  const router = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [meta, setMeta] = useState<Partial<TestRow>>({});
  const [passageDraft, setPassageDraft] = useState<{ id?: string; label: string; body: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [filter, setFilter] = useState<"all" | "review" | "nokey">("all");

  const load = useCallback(async () => {
    const res = await fetch(`/api/attestation/tests/${params.testId}`);
    const body = (await res.json()) as Loaded & { error?: string };
    if (!res.ok) setError(body.error ?? "Could not load the test");
    else {
      setData(body);
      setMeta(body.test);
    }
  }, [params.testId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchTest(update: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/attestation/tests/${params.testId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const body = (await res.json()) as { error?: string; blockers?: string[] };
    if (!res.ok) setError([body.error, ...(body.blockers ?? []).slice(0, 10)].filter(Boolean).join(" · "));
    await load();
  }

  async function saveMeta() {
    await patchTest({
      subject: meta.subject,
      title: meta.title,
      year: meta.year || null,
      description: meta.description || null,
      time_limit_minutes: meta.time_limit_minutes ? Number(meta.time_limit_minutes) : null,
      max_attempts: Number(meta.max_attempts) || 1,
    });
  }

  async function removeQuestion(id: string, number: string) {
    if (!confirm(`Delete question ${number}?`)) return;
    await fetch(`/api/attestation/questions/${id}`, { method: "DELETE" });
    await load();
  }

  async function savePassage() {
    if (!passageDraft) return;
    const url = passageDraft.id ? `/api/attestation/passages/${passageDraft.id}` : `/api/attestation/tests/${params.testId}/passages`;
    const res = await fetch(url, {
      method: passageDraft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: passageDraft.label || null, body: passageDraft.body }),
    });
    if (!res.ok) setError(((await res.json()) as { error?: string }).error ?? "Could not save the passage");
    else {
      setPassageDraft(null);
      await load();
    }
  }

  async function deleteTest() {
    if (!confirm("Delete this test and all its questions? This cannot be undone.")) return;
    const res = await fetch(`/api/attestation/tests/${params.testId}`, { method: "DELETE" });
    if (!res.ok) setError(((await res.json()) as { error?: string }).error ?? "Could not delete");
    else router.push("/attestation/manage");
  }

  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;
  const { test, passages, questions, figures, blockers } = data;
  const passageLabel = (id: string | null) => {
    const i = passages.findIndex((p) => p.id === id);
    return i < 0 ? null : passages[i]!.label || `Passage ${i + 1}`;
  };
  const shown = questions.filter((q) =>
    filter === "review" ? q.needs_review : filter === "nokey" ? validateCorrect(q).length > 0 : true,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/attestation/manage" className="text-sm text-gray-500 hover:underline">
            ← All tests
          </Link>
          <h1 className="text-2xl font-semibold">{test.title}</h1>
          <p className="text-sm text-gray-500">
            {test.subject} · {questions.length} questions · status: <b>{test.status}</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/attestation/manage/${test.id}/results`} className="px-3 py-2 rounded-lg border text-sm">
            Results
          </Link>
          {test.status !== "published" ? (
            <button type="button" onClick={() => void patchTest({ status: "published" })} className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm">
              Publish
            </button>
          ) : (
            <button type="button" onClick={() => void patchTest({ status: "draft" })} className="px-3 py-2 rounded-lg border text-sm">
              Unpublish
            </button>
          )}
          {test.status !== "archived" && (
            <button type="button" onClick={() => void patchTest({ status: "archived" })} className="px-3 py-2 rounded-lg border text-sm">
              Archive
            </button>
          )}
          <button type="button" onClick={() => void deleteTest()} className="px-3 py-2 rounded-lg border text-sm text-red-600">
            Delete
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {blockers.length > 0 && (
        <details className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-amber-800">
            {blockers.length} thing{blockers.length === 1 ? "" : "s"} to fix before publishing
          </summary>
          <ul className="mt-2 list-disc pl-5 space-y-0.5 text-amber-900">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </details>
      )}

      <section className="bg-white rounded-xl border p-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Subject
          <input className="border rounded px-2 py-1 w-full" value={meta.subject ?? ""} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} />
        </label>
        <label className="text-sm md:col-span-2">
          Title
          <input className="border rounded px-2 py-1 w-full" value={meta.title ?? ""} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        </label>
        <label className="text-sm">
          Year
          <input className="border rounded px-2 py-1 w-full" value={meta.year ?? ""} onChange={(e) => setMeta({ ...meta, year: e.target.value })} />
        </label>
        <label className="text-sm">
          Time limit (minutes, empty = none)
          <input
            type="number"
            min={1}
            className="border rounded px-2 py-1 w-full"
            value={meta.time_limit_minutes ?? ""}
            onChange={(e) => setMeta({ ...meta, time_limit_minutes: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <label className="text-sm">
          Attempts allowed per teacher
          <input type="number" min={1} className="border rounded px-2 py-1 w-full" value={meta.max_attempts ?? 1} onChange={(e) => setMeta({ ...meta, max_attempts: Number(e.target.value) })} />
        </label>
        <label className="text-sm md:col-span-3">
          Instructions shown to teachers (optional)
          <textarea rows={2} className="border rounded px-2 py-1 w-full" value={meta.description ?? ""} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
        </label>
        <div>
          <button type="button" onClick={() => void saveMeta()} className="px-4 py-2 rounded-lg border text-sm">
            Save details
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Answer key</h2>
          <button type="button" onClick={() => setShowKey((s) => !s)} className="text-sm text-violet-700 underline">
            {showKey ? "Hide" : "Import key from PDF"}
          </button>
        </div>
        {showKey && (
          <KeyImporter
            testId={test.id}
            onApplied={() => {
              setShowKey(false);
              void load();
            }}
          />
        )}
      </section>

      <section className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Shared passages ({passages.length})</h2>
          <button type="button" onClick={() => setPassageDraft({ label: "", body: "" })} className="text-sm text-violet-700 underline">
            + Add passage
          </button>
        </div>
        {passageDraft && (
          <div className="space-y-2 border rounded-lg p-3">
            <input className="border rounded px-2 py-1 w-full text-sm" placeholder="Label (e.g. Text for questions 1–10)" value={passageDraft.label} onChange={(e) => setPassageDraft({ ...passageDraft, label: e.target.value })} />
            <textarea rows={6} className="border rounded px-2 py-1 w-full text-sm font-mono" value={passageDraft.body} onChange={(e) => setPassageDraft({ ...passageDraft, body: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => void savePassage()} className="px-3 py-1.5 rounded bg-violet-600 text-white text-sm">
                Save passage
              </button>
              <button type="button" onClick={() => setPassageDraft(null)} className="px-3 py-1.5 rounded border text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
        {passages.map((p, i) => (
          <details key={p.id} className="border rounded-lg p-2">
            <summary className="cursor-pointer text-sm">
              {p.label || `Passage ${i + 1}`}{" "}
              <span className="text-gray-400">· {questions.filter((q) => q.passage_id === p.id).length} questions</span>
            </summary>
            <div className="mt-2 space-y-2">
              <RichText text={p.body} />
              <div className="flex gap-3 text-sm">
                <button type="button" className="text-violet-700 underline" onClick={() => setPassageDraft({ id: p.id, label: p.label ?? "", body: p.body })}>
                  Edit
                </button>
                <button
                  type="button"
                  className="text-red-600 underline"
                  onClick={async () => {
                    if (!confirm("Delete this passage? Its questions stay.")) return;
                    await fetch(`/api/attestation/passages/${p.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </details>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Questions</h2>
          <div className="flex items-center gap-3 text-sm">
            <select className="border rounded px-2 py-1" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All ({questions.length})</option>
              <option value="review">Needs review ({questions.filter((q) => q.needs_review).length})</option>
              <option value="nokey">Key problems ({questions.filter((q) => validateCorrect(q).length > 0).length})</option>
            </select>
            <button type="button" onClick={() => setEditing("new")} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white">
              + Add question
            </button>
          </div>
        </div>

        {editing === "new" && (
          <QuestionEditor
            initial={{ ...EMPTY_QUESTION, number: String(questions.length + 1) }}
            passages={passages}
            figureUrl={null}
            saveUrl={`/api/attestation/tests/${test.id}/questions`}
            method="POST"
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        )}

        {shown.map((q) =>
          editing === q.id ? (
            <QuestionEditor
              key={q.id}
              initial={q as EditableQuestion}
              passages={passages}
              figureUrl={q.image_path ? figures[q.image_path] ?? null : null}
              saveUrl={`/api/attestation/questions/${q.id}`}
              method="PATCH"
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                void load();
              }}
            />
          ) : (
            <div key={q.id} className={`bg-white rounded-xl border p-3 ${q.needs_review ? "border-amber-300" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">
                    Q{q.number} · {TYPE_SHORT[q.answer_type]} · {q.points} pt{q.points === 1 ? "" : "s"}
                    {q.scoring === "partial" ? " · partial" : ""}
                    {q.passage_id ? ` · ${passageLabel(q.passage_id)}` : ""}
                    {q.image_path ? " · 🖼 figure" : ""}
                  </p>
                  <div className="line-clamp-3">
                    <RichText text={q.prompt || "_no text_"} />
                  </div>
                  <p className="text-xs mt-1">
                    Key: <span className="font-mono">{formatCorrect(q.answer_type, q.correct)}</span>
                    {validateCorrect(q).length > 0 && <span className="text-amber-700"> · {validateCorrect(q).join(" · ")}</span>}
                  </p>
                  {q.needs_review && <p className="text-xs text-amber-800 mt-1">⚑ Needs review{q.review_note ? `: ${q.review_note}` : ""}</p>}
                </div>
                <div className="flex gap-3 text-sm shrink-0">
                  <button type="button" className="text-violet-700 underline" onClick={() => setEditing(q.id)}>
                    Edit
                  </button>
                  <button type="button" className="text-red-600 underline" onClick={() => void removeQuestion(q.id, q.number)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
      </section>
    </div>
  );
}
