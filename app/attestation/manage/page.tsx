"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TakersPanel } from "@/components/attestation/takers-panel";
import { ManagersPanel } from "@/components/attestation/managers-panel";

interface TestSummary {
  id: string;
  subject: string;
  title: string;
  year: string | null;
  status: "draft" | "published" | "archived";
  time_limit_minutes: number | null;
  question_count: number;
  review_count: number;
  submitted_count: number;
}

const STATUS_STYLE: Record<TestSummary["status"], string> = {
  draft: "bg-amber-50 text-amber-700",
  published: "bg-green-50 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function ManageTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<TestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [allLimit, setAllLimit] = useState("");
  const [limitNotice, setLimitNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/attestation/tests");
    const body = (await res.json()) as { tests?: TestSummary[]; error?: string };
    if (!res.ok) setError(body.error ?? "Could not load tests");
    else {
      setTests(body.tests ?? []);
      setLimits(Object.fromEntries((body.tests ?? []).map((t) => [t.id, t.time_limit_minutes ? String(t.time_limit_minutes) : ""])));
    }
  }, []);

  /** "" = no limit; otherwise whole minutes 1–600 (the API's bounds). */
  function parseLimit(v: string): number | null | "bad" {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 600 ? n : "bad";
  }

  async function saveLimits(ids: string[], value: string) {
    const minutes = parseLimit(value);
    if (minutes === "bad") {
      setLimitNotice({ kind: "error", text: "Time limit must be whole minutes between 1 and 600, or empty for no limit." });
      return;
    }
    setLimitNotice(null);
    const failed: string[] = [];
    for (const id of ids) {
      const res = await fetch(`/api/attestation/tests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_limit_minutes: minutes }),
      });
      if (!res.ok) failed.push(tests?.find((t) => t.id === id)?.subject ?? id);
    }
    await load();
    if (failed.length) setLimitNotice({ kind: "error", text: `Could not save the time limit for: ${failed.join(", ")}` });
    else
      setLimitNotice({
        kind: "ok",
        text: `${minutes ? `Time limit set to ${minutes} min` : "Time limit removed"} for ${ids.length} test${ids.length === 1 ? "" : "s"}. Teachers already in a test keep the time they started with.`,
      });
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!subject.trim() || !title.trim()) {
      setError("Enter a subject and a title");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/attestation/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, title }),
    });
    const body = (await res.json()) as { id?: string; error?: string };
    setBusy(false);
    if (!res.ok || !body.id) setError(body.error ?? "Could not create the test");
    else router.push(`/attestation/manage/${body.id}`);
  }

  async function importBundle(file: File) {
    setBusy(true);
    setError(null);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setBusy(false);
      setError("That file is not valid JSON");
      return;
    }
    const res = await fetch("/api/attestation/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });
    const body = (await res.json()) as { id?: string; error?: string };
    setBusy(false);
    if (!res.ok || !body.id) setError(body.error ?? "Import failed");
    else router.push(`/attestation/manage/${body.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Manage attestation tests</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <p className="font-medium">New empty test</p>
          <p className="text-xs text-gray-500">Add questions by hand, then import the answer key.</p>
          <input className="border rounded-md px-3 py-2 w-full text-sm" placeholder="Subject (e.g. Մաթեմատիկա)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <input className="border rounded-md px-3 py-2 w-full text-sm" placeholder="Title (e.g. Մաթեմատիկա · 2024 · Թեստ 1)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" disabled={busy} onClick={() => void create()} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">
            Create test
          </button>
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-2">
          <p className="font-medium">Import a test bundle (JSON)</p>
          <p className="text-xs text-gray-500">
            Creates a draft with all questions and passages. Items flagged for review must be resolved before publishing.
          </p>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importBundle(f);
              e.target.value = "";
            }}
            className="text-sm"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <ManagersPanel />

      <TakersPanel tests={tests ?? []} />

      {tests === null ? (
        <p className="text-gray-500">Loading…</p>
      ) : tests.length === 0 ? (
        <p className="text-gray-500">No tests yet.</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b text-sm">
            <span className="text-gray-700">Time limit for every test:</span>
            <input
              aria-label="Time limit for every test, in minutes"
              inputMode="numeric"
              className="border rounded px-2 py-1 w-20"
              placeholder="min"
              value={allLimit}
              onChange={(e) => setAllLimit(e.target.value)}
            />
            <span className="text-gray-500">minutes</span>
            <button
              type="button"
              className="px-3 py-1 rounded border"
              onClick={() => {
                const what = allLimit.trim() ? `${allLimit.trim()} minutes` : "no time limit";
                if (confirm(`Set ${what} on all ${tests.length} tests?`)) void saveLimits(tests.map((t) => t.id), allLimit);
              }}
            >
              Apply to all
            </button>
            <span className="text-xs text-gray-500">Empty = no limit. The clock starts when a teacher presses Start; at zero the test is submitted as it stands.</span>
          </div>
          {limitNotice && (
            <p role="status" className={`px-4 py-2 text-sm border-b ${limitNotice.kind === "error" ? "text-red-600" : "text-green-700"}`}>
              {limitNotice.text}
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Time limit</th>
                <th className="px-4 py-2 text-right">Questions</th>
                <th className="px-4 py-2 text-right">Needs review</th>
                <th className="px-4 py-2 text-right">Submitted</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2">{t.subject}</td>
                  <td className="px-4 py-2">
                    <Link href={`/attestation/manage/${t.id}`} className="text-violet-700 hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <input
                      aria-label={`Time limit for ${t.subject}, in minutes`}
                      inputMode="numeric"
                      className="border rounded px-2 py-0.5 w-16"
                      placeholder="none"
                      value={limits[t.id] ?? ""}
                      onChange={(e) => setLimits({ ...limits, [t.id]: e.target.value })}
                      onBlur={(e) => {
                        const saved = t.time_limit_minutes ? String(t.time_limit_minutes) : "";
                        if (e.target.value.trim() !== saved) void saveLimits([t.id], e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />{" "}
                    <span className="text-gray-500">min</span>
                  </td>
                  <td className="px-4 py-2 text-right">{t.question_count}</td>
                  <td className={`px-4 py-2 text-right ${t.review_count ? "text-amber-700 font-medium" : "text-gray-400"}`}>{t.review_count}</td>
                  <td className="px-4 py-2 text-right">{t.submitted_count}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/attestation/manage/${t.id}/results`} className="text-gray-600 hover:underline">
                      Results
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
