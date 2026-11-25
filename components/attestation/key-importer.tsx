"use client";

import { useState } from "react";
import { formatCorrect, type AnswerType, type Correct } from "@/lib/attestation-core";

interface Proposal {
  id: string;
  number: string;
  answer_type: AnswerType;
  raw: string | null;
  proposed: Correct | null;
  current: Correct | null;
  changed: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Answer-key import: upload the key PDF (or paste its text), review what the
 * mechanical parser read for every question, tick what to apply. Nothing is saved
 * until "Apply". Questions it could not read are listed for manual entry.
 */
export function KeyImporter({ testId, onApplied }: { testId: string; onApplied: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ found: number; expected: number; strategy: string; proposals: Proposal[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function parse(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/attestation/tests/${testId}/key`, { method: "POST", body: form });
    const body = (await res.json()) as { error?: string; found: number; expected: number; strategy: string; proposals: Proposal[] };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not read the key");
      return;
    }
    setResult(body);
    // Pre-tick rows that change something and have no blocking error.
    setSelected(new Set(body.proposals.filter((p) => p.changed && p.proposed !== null && p.errors.length === 0).map((p) => p.id)));
  }

  async function apply() {
    if (!result) return;
    const updates = result.proposals.filter((p) => selected.has(p.id)).map((p) => ({ id: p.id, correct: p.proposed }));
    if (updates.length === 0) return;
    setBusy(true);
    const res = await fetch(`/api/attestation/tests/${testId}/key`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) setError(body.error ?? "Could not save");
    else {
      setResult(null);
      onApplied();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <label className="text-sm">
          Key PDF
          <input
            type="file"
            accept="application/pdf"
            disabled={busy}
            className="block text-sm mt-1"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append("file", f);
              void parse(fd);
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex-1 min-w-[16rem] space-y-1">
          <p className="text-sm">…or paste the key (one “number answer” per line)</p>
          <textarea rows={3} className="border rounded px-2 py-1 w-full text-sm font-mono" value={text} onChange={(e) => setText(e.target.value)} />
          <button
            type="button"
            disabled={busy || !text.trim()}
            className="px-3 py-1.5 rounded border text-sm disabled:opacity-50"
            onClick={() => {
              const fd = new FormData();
              fd.append("text", text);
              void parse(fd);
            }}
          >
            Read pasted key
          </button>
        </div>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {result && (
        <div className="space-y-2">
          <p className="text-sm">
            Read <b>{result.found}</b> of {result.expected} questions (strategy: {result.strategy}).{" "}
            {result.found < result.expected && <span className="text-amber-700">Enter the rest by hand in each question.</span>}
          </p>
          <div className="max-h-[28rem] overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500 sticky top-0">
                <tr>
                  <th className="px-2 py-1">Apply</th>
                  <th className="px-2 py-1">Q</th>
                  <th className="px-2 py-1">In key</th>
                  <th className="px-2 py-1">Will set</th>
                  <th className="px-2 py-1">Currently</th>
                  <th className="px-2 py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {result.proposals.map((p) => (
                  <tr key={p.id} className={`border-t ${p.changed ? "bg-amber-50" : ""}`}>
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        disabled={p.proposed === null}
                        checked={selected.has(p.id)}
                        onChange={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">{p.number}</td>
                    <td className="px-2 py-1 font-mono">{p.raw ?? "—"}</td>
                    <td className="px-2 py-1">{formatCorrect(p.answer_type, p.proposed)}</td>
                    <td className="px-2 py-1 text-gray-500">{formatCorrect(p.answer_type, p.current)}</td>
                    <td className="px-2 py-1 text-xs">
                      {[...p.errors.map((e) => `✖ ${e}`), ...p.warnings].join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={busy || selected.size === 0} onClick={() => void apply()} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">
            Apply {selected.size} answer{selected.size === 1 ? "" : "s"}
          </button>
        </div>
      )}
    </div>
  );
}
