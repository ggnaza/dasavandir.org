"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RichText } from "@/components/attestation/rich-text";
import { AnswerInput, type AnswerValue } from "@/components/attestation/answer-input";
import type { AttemptRow, QuestionRow, TestRow } from "@/lib/attestation/server";

type Attempt = AttemptRow & { full_name: string | null; email: string | null };

/** Staff-only results: one row per attempt, expandable to every answer against the key. */
export default function ResultsPage({ params }: { params: { testId: string } }) {
  const [test, setTest] = useState<TestRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [t, r] = await Promise.all([
      fetch(`/api/attestation/tests/${params.testId}`).then((x) => x.json()),
      fetch(`/api/attestation/tests/${params.testId}/results`).then((x) => x.json()),
    ]);
    if (t.error || r.error) {
      setError(t.error ?? r.error);
      return;
    }
    setTest(t.test);
    setQuestions(t.questions);
    setAttempts(r.attempts);
  }, [params.testId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reset(a: Attempt) {
    if (!confirm(`Delete ${a.full_name ?? a.email ?? "this"} attempt so they can take the test again?`)) return;
    setNotice(null);
    const res = await fetch(`/api/attestation/attempts/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setNotice({ kind: "error", text: body.error ?? "Reset failed" });
      return;
    }
    if (open === a.id) setOpen(null);
    await load();
  }

  async function regrade() {
    if (!confirm("Re-grade every submitted attempt against the current answer key?")) return;
    const res = await fetch(`/api/attestation/tests/${params.testId}/regrade`, { method: "POST" });
    const body = (await res.json()) as { regraded?: number; changed?: number; error?: string };
    // Shown on the page, not in alert(): a native dialog blocks the page until dismissed.
    if (!res.ok) setNotice({ kind: "error", text: body.error ?? "Regrade failed" });
    else {
      setNotice({ kind: "ok", text: `Re-graded ${body.regraded} attempts; ${body.changed} scores changed.` });
      await load();
    }
  }

  function downloadCsv() {
    if (!attempts || !test) return;
    // Neutralise spreadsheet formulas in user-controlled cells (names starting = + - @).
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Name", "Email", "Status", "Submitted", "Score", "Max", "Percent"],
      ...attempts.map((a) => [a.full_name, a.email, a.status, a.submitted_at, a.score, a.max_score, a.percent]),
    ];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${test.title} - results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!test || !attempts) return <p className="text-gray-500">Loading…</p>;

  const submitted = attempts.filter((a) => a.status === "submitted");
  const avg = submitted.length ? submitted.reduce((s, a) => s + Number(a.percent ?? 0), 0) / submitted.length : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/attestation/manage/${test.id}`} className="text-sm text-gray-500 hover:underline">
            ← {test.title}
          </Link>
          <h1 className="text-2xl font-semibold">Results</h1>
          <p className="text-sm text-gray-500">
            {submitted.length} submitted · {attempts.length - submitted.length} in progress
            {avg !== null && ` · average ${avg.toFixed(1)}%`}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void regrade()} className="px-3 py-2 rounded-lg border text-sm" title="Use after correcting the answer key">
            Regrade
          </button>
          <button type="button" onClick={downloadCsv} className="px-3 py-2 rounded-lg border text-sm">
            Download CSV
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className={`text-sm ${notice.kind === "error" ? "text-red-600" : "text-green-700"}`}>
          {notice.text}
        </p>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Teacher</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Submitted</th>
              <th className="px-4 py-2 text-right">Score</th>
              <th className="px-4 py-2 text-right">%</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Nobody has taken this test yet.
                </td>
              </tr>
            )}
            {attempts.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="px-4 py-2">
                  <p>{a.full_name ?? "—"}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                </td>
                <td className="px-4 py-2">{a.status === "submitted" ? "Submitted" : "In progress"}</td>
                <td className="px-4 py-2">{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-2 text-right">{a.score !== null ? `${Number(a.score)} / ${Number(a.max_score)}` : "—"}</td>
                <td className="px-4 py-2 text-right font-medium">{a.percent !== null ? `${Number(a.percent).toFixed(1)}%` : "—"}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {a.status === "submitted" && (
                    <button type="button" className="text-violet-700 underline mr-3" onClick={() => setOpen(open === a.id ? null : a.id)}>
                      {open === a.id ? "Hide" : "Answers"}
                    </button>
                  )}
                  <button type="button" className="text-red-600 underline" onClick={() => void reset(a)}>
                    Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open &&
        (() => {
          const a = attempts.find((x) => x.id === open);
          if (!a) return null;
          return (
            <div className="space-y-3">
              <h2 className="font-semibold">Answers — {a.full_name ?? a.email}</h2>
              {questions.map((q) => {
                const r = a.item_results?.[q.id];
                return (
                  <div key={q.id} className={`bg-white rounded-xl border p-3 ${r?.correct ? "border-green-300" : r?.answered ? "border-red-300" : "border-gray-200"}`}>
                    <p className="text-xs text-gray-500">
                      Q{q.number} · {r ? `${r.earned} / ${r.max}` : "—"} {r && !r.answered ? "· not answered" : ""}
                    </p>
                    <div className="line-clamp-2">
                      <RichText text={q.prompt} />
                    </div>
                    <AnswerInput
                      type={q.answer_type}
                      options={q.options}
                      slots={q.match_slots}
                      value={(a.answers[q.id] as AnswerValue) ?? null}
                      correct={q.correct as AnswerValue}
                      disabled
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}
    </div>
  );
}
