"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { TOTAL_QUESTIONS, type AnswerKeyItem } from "@/lib/gnahatum/constants";
import { AnswerKeyEditor } from "@/components/gnahatum/answer-key-editor";

interface Subject {
  id: string;
  name_hy: string;
  name_en: string;
}

export interface TestRow {
  id: string;
  subject_id: string;
  grade: number;
  test_type: string;
  year: string;
  source_file_id: string | null;
  /** How many of the 15 answers are non-empty. */
  answered: number;
  scan_count: number;
}

const TYPE_LABEL: Record<string, string> = {
  diagnostic: "Հայտորոշիչ",
  diagnostic_base: "Հայտորոշիչ · հենքային",
  diagnostic_target: "Հայտորոշիչ · նպատակային",
  summative: "Ամփոփիչ",
};

export function TestManager({ subjects, tests }: { subjects: Subject[]; tests: TestRow[] }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState<AnswerKeyItem[] | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; details?: string[] } | null>(null);

  const rows = useMemo(
    () =>
      tests
        .filter((t) => t.subject_id === subjectId)
        .sort((a, b) => a.grade - b.grade || a.test_type.localeCompare(b.test_type)),
    [tests, subjectId],
  );

  const subject = subjects.find((s) => s.id === subjectId);
  const blanks = items?.filter((i) => !i.answer.trim()).map((i) => i.number) ?? [];

  async function openTest(id: string) {
    if (openId === id) {
      setOpenId(null);
      setItems(null);
      return;
    }
    setMessage(null);
    setLoading(true);
    setOpenId(id);
    try {
      const res = await fetch(`/api/gnahatum/tests/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setItems(body.answer_key as AnswerKeyItem[]);
      setNotes(body.scoring_notes ?? "");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Could not load" });
      setOpenId(null);
    } finally {
      setLoading(false);
    }
  }

  function updateItem(number: number, patch: Partial<AnswerKeyItem>) {
    setItems((prev) => prev?.map((i) => (i.number === number ? { ...i, ...patch } : i)) ?? prev);
  }

  async function save(row: TestRow) {
    if (!items) return;
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/gnahatum/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: row.subject_id,
          grade: row.grade,
          test_type: row.test_type,
          year: row.year,
          answer_key: items,
          scoring_notes: notes.trim() || null,
          source_file_id: row.source_file_id,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ kind: "error", text: body.error ?? `HTTP ${res.status}`, details: body.details });
        return;
      }
      setMessage({ kind: "ok", text: "Saved. Future scans of this test grade against the updated key." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Subject</span>
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setOpenId(null);
              setItems(null);
              setMessage(null);
            }}
            className="mt-1 border rounded-md px-3 py-2 text-sm min-w-[16rem]"
          >
            {subjects.map((s) => {
              const n = tests.filter((t) => t.subject_id === s.id).length;
              return (
                <option key={s.id} value={s.id}>
                  {s.name_hy} — {n === 0 ? "no tests" : `${n} test${n === 1 ? "" : "s"}`}
                </option>
              );
            })}
          </select>
        </label>

        <Link
          href="/gnahatum/tests/import"
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
        >
          Import a new test
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <p className="font-medium">No tests for {subject?.name_hy} yet</p>
          <p className="text-sm mt-1">
            Use <span className="font-medium">Import a new test</span> to add one from its document.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Grade</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Year</th>
                <th className="text-left px-4 py-2 font-medium">Answer key</th>
                <th className="text-left px-4 py-2 font-medium">Scans</th>
                <th className="text-left px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const complete = row.answered === TOTAL_QUESTIONS;
                const isOpen = openId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t">
                      <td className="px-4 py-2 font-medium text-gray-900">{row.grade}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {TYPE_LABEL[row.test_type] ?? row.test_type}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{row.year}</td>
                      <td className="px-4 py-2">
                        <span className={complete ? "text-emerald-700" : "text-red-600 font-medium"}>
                          {row.answered} / {TOTAL_QUESTIONS}
                          {!complete && " — incomplete"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{row.scan_count || "—"}</td>
                      <td className="px-4 py-2">
                        {row.source_file_id ? (
                          <a
                            href={`https://docs.google.com/document/d/${row.source_file_id}/edit`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 underline"
                          >
                            document
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => openTest(row.id)}
                          className="px-3 py-1 rounded-md border text-xs font-medium hover:bg-gray-50"
                        >
                          {isOpen ? "Close" : "View / replace key"}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-t bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          {loading || !items ? (
                            <p className="text-sm text-gray-500">Loading the answer key…</p>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-sm text-gray-600">
                                Grade {row.grade} · {TYPE_LABEL[row.test_type] ?? row.test_type} ·{" "}
                                {row.year}. Editing this replaces the key in place — the test keeps its
                                id, so {row.scan_count > 0
                                  ? `the ${row.scan_count} existing scan${row.scan_count === 1 ? "" : "s"} and their results stay attached.`
                                  : "any existing scans and results stay attached."}
                              </p>

                              {blanks.length > 0 && (
                                <p className="text-sm text-red-600">
                                  Q{blanks.join(", Q")} {blanks.length === 1 ? "has" : "have"} no
                                  answer — fill {blanks.length === 1 ? "it" : "them"} in before saving.
                                </p>
                              )}

                              <label className="block">
                                <span className="text-sm font-medium text-gray-700">
                                  Notes for the scorer
                                </span>
                                <textarea
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  rows={2}
                                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                                />
                              </label>

                              <AnswerKeyEditor items={items} onChange={updateItem} />

                              {message && (
                                <div className={message.kind === "ok" ? "text-emerald-700" : "text-red-600"}>
                                  <p className="text-sm">{message.text}</p>
                                  {message.details && (
                                    <ul className="text-sm list-disc pl-5 mt-1">
                                      {message.details.map((d, i) => (
                                        <li key={i}>{d}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}

                              <div className="flex gap-3">
                                <button
                                  onClick={() => save(row)}
                                  disabled={saving || blanks.length > 0}
                                  className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  {saving ? "Saving…" : "Save answer key"}
                                </button>
                                <Link
                                  href="/gnahatum/tests/import"
                                  className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-gray-50"
                                >
                                  Re-import from document
                                </Link>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {message && !openId && (
        <p className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
