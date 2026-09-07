"use client";

import { useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { SCAN_BUCKET, MAX_SCAN_BYTES } from "@/lib/gnahatum/storage";
import { POINT_DISTRIBUTION, TOTAL_QUESTIONS } from "@/lib/gnahatum/constants";

interface Subject {
  id: string;
  name_hy: string;
  name_en: string;
}

interface Test {
  id: string;
  subject_id: string;
  grade: number;
  test_type: string;
  year: string;
  goldCount: number;
}

interface BenchmarkSummary {
  run_batch: string;
  model_id: string;
  scored: number;
  failed: number;
  used_learning: boolean;
  mean_abs_delta: number | null;
  item_accuracy_pct: number | null;
}

const QUESTIONS = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1);

export function GoldSetManager({
  subjects,
  tests,
  models,
}: {
  subjects: Subject[];
  tests: Test[];
  models: Array<{ id: string; name: string }>;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [testId, setTestId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [studentLabel, setStudentLabel] = useState("");
  const [scores, setScores] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [limit, setLimit] = useState("10");
  const [includeLearning, setIncludeLearning] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchmarkSummary | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState<number | null>(null);

  const subjectTests = useMemo(
    () => tests.filter((t) => t.subject_id === subjectId),
    [tests, subjectId],
  );

  const enteredTotal = useMemo(
    () =>
      QUESTIONS.reduce((sum, n) => {
        const raw = scores[n];
        const value = raw === undefined || raw === "" ? 0 : Number(raw);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [scores],
  );

  const overMax = QUESTIONS.filter((n) => {
    const raw = scores[n];
    if (raw === undefined || raw === "") return false;
    const value = Number(raw);
    return !Number.isFinite(value) || value < 0 || value > (POINT_DISTRIBUTION[n] ?? 0);
  });

  async function handleUpload() {
    setMessage(null);

    if (!testId) return setMessage({ kind: "error", text: "Pick a test first." });
    if (!file) return setMessage({ kind: "error", text: "Choose a scanned answer sheet." });
    if (file.size > MAX_SCAN_BYTES) {
      return setMessage({ kind: "error", text: "That file is over the 32MB limit." });
    }
    if (overMax.length) {
      return setMessage({
        kind: "error",
        text: `Q${overMax.join(", Q")}: score is outside the allowed range.`,
      });
    }

    const items = QUESTIONS.filter((n) => scores[n] !== undefined && scores[n] !== "").map((n) => ({
      question_number: n,
      human_points: Number(scores[n]),
    }));

    if (items.length === 0) {
      return setMessage({ kind: "error", text: "Enter at least one question score." });
    }

    setSaving(true);
    try {
      const contentType = file.type || "application/pdf";
      const urlRes = await fetch("/api/gnahatum/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: contentType, batch_id: "gold" }),
      });
      if (!urlRes.ok) {
        const b = await urlRes.json().catch(() => ({ error: "Could not start upload" }));
        throw new Error(b.error ?? `HTTP ${urlRes.status}`);
      }
      const { path, token } = (await urlRes.json()) as { path: string; token: string };

      const supabase = createSupabaseClient();
      const { error: uploadErr } = await supabase.storage
        .from(SCAN_BUCKET)
        .uploadToSignedUrl(path, token, file, { contentType });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const res = await fetch("/api/gnahatum/training/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_id: testId,
          storage_path: path,
          student_label: studentLabel || null,
          items,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ error: "Could not save" }));
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as { human_total: number };

      setMessage({
        kind: "ok",
        text: `Saved as ground truth — ${saved.human_total} / 15. Add the next one.`,
      });
      setFile(null);
      setStudentLabel("");
      setScores({});
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleBenchmark() {
    setResult(null);
    setPromoted(null);
    setRunning(true);
    try {
      const res = await fetch("/api/gnahatum/training/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: modelId,
          test_id: testId || null,
          limit: Number(limit) || 10,
          include_learning: includeLearning,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body as BenchmarkSummary);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Benchmark failed" });
    } finally {
      setRunning(false);
    }
  }

  async function handlePromote() {
    if (!result) return;
    setPromoting(true);
    try {
      const res = await fetch("/api/gnahatum/training/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_batch: result.run_batch }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPromoted(body.variants_learned as number);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Promote failed" });
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg border p-5">
        <h2 className="text-lg font-semibold text-gray-900">Add a human-scored test</h2>
        <p className="text-sm text-gray-600 mt-1">
          Upload the scan and type the scores the teacher actually gave, question by question.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Subject</span>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTestId("");
              }}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_hy} ({s.name_en})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Test</span>
            <select
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              disabled={!subjectId}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
            >
              <option value="">Select test…</option>
              {subjectTests.map((t) => (
                <option key={t.id} value={t.id}>
                  Grade {t.grade} · {t.test_type} · {t.year}
                  {t.goldCount > 0 ? ` — ${t.goldCount} in gold set` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Scanned answer sheet</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Label (optional)</span>
            <input
              value={studentLabel}
              onChange={(e) => setStudentLabel(e.target.value)}
              placeholder="e.g. Sample 12"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-700">Teacher&rsquo;s scores</span>
            <span className="text-sm text-gray-500">Total {enteredTotal.toFixed(2)} / 15</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-2">
            {QUESTIONS.map((n) => {
              const max = POINT_DISTRIBUTION[n] ?? 0;
              const invalid = overMax.includes(n);
              return (
                <label key={n} className="block">
                  <span className="text-xs text-gray-500">
                    Q{n} <span className="text-gray-400">/ {max}</span>
                  </span>
                  <input
                    inputMode="decimal"
                    value={scores[n] ?? ""}
                    onChange={(e) => setScores((prev) => ({ ...prev, [n]: e.target.value }))}
                    placeholder="—"
                    className={`mt-1 w-full border rounded-md px-2 py-1.5 text-sm ${
                      invalid ? "border-red-400 bg-red-50" : ""
                    }`}
                  />
                </label>
              );
            })}
          </div>
        </div>

        {message && (
          <p
            className={`mt-4 text-sm ${
              message.kind === "ok" ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={saving}
          className="mt-4 px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save as ground truth"}
        </button>
      </section>

      <section className="bg-white rounded-lg border p-5">
        <h2 className="text-lg font-semibold text-gray-900">Benchmark a model</h2>
        <p className="text-sm text-gray-600 mt-1">
          Scores the gold set with the model you pick and compares it to the human scores. Each
          scan is one paid model call, so start small.
        </p>

        <div className="grid gap-4 sm:grid-cols-3 mt-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Model</span>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">How many scans</span>
            <input
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 sm:mt-6">
            <input
              type="checkbox"
              checked={includeLearning}
              onChange={(e) => setIncludeLearning(e.target.checked)}
            />
            <span className="text-sm text-gray-700">Include learned knowledge</span>
          </label>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          {testId
            ? "Scoped to the test selected above."
            : "Runs across the whole gold set — pick a test above to narrow it."}
        </p>

        <button
          onClick={handleBenchmark}
          disabled={running || !modelId}
          className="mt-4 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {running ? "Running…" : "Run benchmark"}
        </button>

        {result && (
          <div className="mt-5 border-t pt-4 text-sm">
            <p className="text-gray-900 font-medium">
              {result.model_id}: {result.scored} scored
              {result.failed > 0 ? `, ${result.failed} failed` : ""}
            </p>
            <p className="text-gray-600 mt-1">
              Average total error{" "}
              <span className="font-medium">
                {result.mean_abs_delta === null ? "—" : `${result.mean_abs_delta} pts`}
              </span>{" "}
              · per-question accuracy{" "}
              <span className="font-medium">
                {result.item_accuracy_pct === null ? "—" : `${result.item_accuracy_pct}%`}
              </span>
            </p>

            {promoted === null ? (
              <button
                onClick={handlePromote}
                disabled={promoting}
                className="mt-3 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {promoting ? "Promoting…" : "Promote disagreements to knowledge"}
              </button>
            ) : (
              <p className="mt-3 text-emerald-700">
                Learned {promoted} answer variant{promoted === 1 ? "" : "s"} from this run.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Promoting records the student wording behind every question the model got wrong, so
              future scans of this test grade it the way the teacher did.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
