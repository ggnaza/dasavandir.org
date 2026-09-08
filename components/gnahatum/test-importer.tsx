"use client";

import { useState } from "react";
import { POINT_DISTRIBUTION, TOTAL_QUESTIONS, type AnswerKeyItem } from "@/lib/gnahatum/constants";
import { QUESTION_TYPES } from "@/lib/gnahatum/import";

interface Subject {
  id: string;
  name_hy: string;
  name_en: string;
}

interface ImportResponse {
  items: AnswerKeyItem[];
  warnings: string[];
  suggested: { subject_hint: string | null; grade: number | null; test_type: string | null; year: string | null };
  source_file_id: string | null;
  error?: string;
  needs_drive?: boolean;
}

const TEST_TYPES = [
  { value: "diagnostic", label: "Հայտորոշիչ (diagnostic)" },
  { value: "diagnostic_base", label: "Հայտորոշիչ · հենքային (base)" },
  { value: "diagnostic_target", label: "Հայտորոշիչ · նպատակային (target)" },
  { value: "summative", label: "Ամփոփիչ (summative)" },
];

export function TestImporter({ subjects }: { subjects: Subject[] }) {
  const [mode, setMode] = useState<"link" | "text">("link");
  const [docUrl, setDocUrl] = useState("");
  const [docText, setDocText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [needsDrive, setNeedsDrive] = useState(false);

  const [items, setItems] = useState<AnswerKeyItem[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceFileId, setSourceFileId] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [grade, setGrade] = useState("");
  const [testType, setTestType] = useState("diagnostic");
  const [year, setYear] = useState("2025");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; details?: string[] } | null>(null);

  const blanks = items?.filter((i) => !i.answer.trim()).map((i) => i.number) ?? [];

  async function handleExtract() {
    setMessage(null);
    setNeedsDrive(false);
    setExtracting(true);
    try {
      const res = await fetch("/api/gnahatum/tests/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "link" ? { doc_url: docUrl } : { text: docText }),
      });
      const body = (await res.json()) as ImportResponse;
      if (!res.ok) {
        if (body.needs_drive) setNeedsDrive(true);
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setItems(body.items);
      setWarnings(body.warnings ?? []);
      setSourceFileId(body.source_file_id ?? null);
      if (body.suggested?.grade) setGrade(String(body.suggested.grade));
      if (body.suggested?.test_type) setTestType(body.suggested.test_type);
      if (body.suggested?.year) setYear(body.suggested.year);
      if (body.suggested?.subject_hint) {
        const hint = body.suggested.subject_hint.toLowerCase();
        const match = subjects.find(
          (s) => hint.includes(s.name_hy.toLowerCase()) || s.name_hy.toLowerCase().includes(hint),
        );
        if (match) setSubjectId(match.id);
      }
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Extraction failed" });
    } finally {
      setExtracting(false);
    }
  }

  function updateItem(number: number, patch: Partial<AnswerKeyItem>) {
    setItems((prev) => prev?.map((i) => (i.number === number ? { ...i, ...patch } : i)) ?? prev);
  }

  async function handleSave() {
    if (!items) return;
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/gnahatum/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subjectId,
          grade: Number(grade),
          test_type: testType,
          year,
          answer_key: items,
          scoring_notes: notes.trim() || null,
          source_file_id: sourceFileId,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ kind: "error", text: body.error ?? `HTTP ${res.status}`, details: body.details });
        return;
      }
      setMessage({ kind: "ok", text: "Saved. The test is now live for scoring — import the next one." });
      setItems(null);
      setWarnings([]);
      setDocUrl("");
      setDocText("");
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg border p-5">
        <div className="flex gap-2 mb-4">
          {(["link", "text"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                mode === m ? "bg-emerald-50 text-emerald-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m === "link" ? "Google Docs link" : "Paste the text"}
            </button>
          ))}
        </div>

        {mode === "link" ? (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Link to the test document</span>
            <input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://docs.google.com/document/d/…"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            />
            <span className="text-xs text-gray-500 mt-1 block">
              Reads Google Docs and .docx files from the Drive account you connect. If a document
              lives elsewhere, switch to &ldquo;Paste the text&rdquo;.
            </span>
          </label>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Document text</span>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              rows={10}
              placeholder="Open the document, select all, paste here. Include the Հավելված 1 answer-key section."
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm font-mono"
            />
          </label>
        )}

        {needsDrive && (
          <p className="mt-3 text-sm">
            <a href="/api/drive/auth" className="text-emerald-700 underline">
              Connect Google Drive
            </a>{" "}
            <span className="text-gray-600">— or paste the text instead.</span>
          </p>
        )}

        <button
          onClick={handleExtract}
          disabled={extracting || (mode === "link" ? !docUrl.trim() : !docText.trim())}
          className="mt-4 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {extracting ? "Reading the document…" : "Extract answer key"}
        </button>
      </section>

      {items && (
        <section className="bg-white rounded-lg border p-5 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Review before saving</h2>
            <p className="text-sm text-gray-600 mt-1">
              Read every answer against the document. This becomes the grading standard for real
              student papers — anything wrong here mis-grades quietly.
            </p>
          </div>

          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <p className="text-sm font-medium text-amber-900 mb-1">
                {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check
              </p>
              <ul className="text-sm text-amber-900 list-disc pl-5 space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {blanks.length > 0 && (
            <p className="text-sm text-red-600">
              Q{blanks.join(", Q")} {blanks.length === 1 ? "has" : "have"} no answer — fill{" "}
              {blanks.length === 1 ? "it" : "them"} in before saving.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Subject</span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_hy}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Grade</span>
              <input
                inputMode="numeric"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Type</span>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              >
                {TEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Year</span>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Notes for the scorer (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Q10-12 are physical tasks the teacher fills in; source key has an error on Q6."
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            />
          </label>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.number}
                className={`border rounded-md p-3 ${item.answer.trim() ? "" : "border-red-300 bg-red-50"}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold text-gray-900 w-14">Q{item.number}</span>
                  <span className="text-xs text-gray-500 w-16">
                    {POINT_DISTRIBUTION[item.number]} pts
                  </span>
                  <select
                    value={item.type}
                    onChange={(e) =>
                      updateItem(item.number, { type: e.target.value as AnswerKeyItem["type"] })
                    }
                    className="border rounded-md px-2 py-1 text-xs"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={item.answer}
                  onChange={(e) => updateItem(item.number, { answer: e.target.value })}
                  rows={2}
                  placeholder="Correct answer"
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  value={(item.accepted_variants ?? []).join(" | ")}
                  onChange={(e) =>
                    updateItem(item.number, {
                      accepted_variants: e.target.value
                        .split("|")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Also accepted, separated by |"
                  className="mt-2 w-full border rounded-md px-2 py-1.5 text-xs"
                />
                <input
                  value={item.scoring_notes ?? ""}
                  onChange={(e) => updateItem(item.number, { scoring_notes: e.target.value })}
                  placeholder="Scoring note, e.g. 2 x 0,5 միավոր"
                  className="mt-2 w-full border rounded-md px-2 py-1.5 text-xs"
                />
              </div>
            ))}
          </div>

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

          <button
            onClick={handleSave}
            disabled={saving || !subjectId || !grade || blanks.length > 0}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : `Save test (${TOTAL_QUESTIONS} questions, 15 points)`}
          </button>
        </section>
      )}

      {!items && message && (
        <p className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
