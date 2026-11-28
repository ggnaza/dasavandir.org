"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface TestChoice {
  id: string;
  subject: string;
  title: string;
  status: "draft" | "published" | "archived";
}
interface Taker {
  user_id: string;
  granted_at: string;
  test_ids: string[];
  profile: { full_name: string | null; email: string | null } | null;
}
interface AddResult {
  added: string[];
  created: string[];
  already: string[];
  managers: string[];
  invalid: string[];
  failed: { email: string; reason: string }[];
  recentlySent: string[];
  emailed: number;
}

/**
 * Managers invite teachers by email to chosen subjects. Each teacher is emailed:
 * someone without an account gets a link that creates it and opens their tests.
 * An invited teacher sees only the tests they were invited to (ADR-0011).
 */
export function TakersPanel({ tests }: { tests: TestChoice[] }) {
  const [takers, setTakers] = useState<Taker[] | null>(null);
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  // Only published tests can be taken, so only they can be chosen.
  const choices = useMemo(() => tests.filter((t) => t.status === "published"), [tests]);
  const label = useMemo(() => new Map(tests.map((t) => [t.id, t.subject])), [tests]);

  const load = useCallback(async () => {
    const res = await fetch("/api/attestation/takers");
    const body = (await res.json()) as { takers?: Taker[]; error?: string };
    if (!res.ok) setError(body.error ?? "Could not load teachers");
    else setTakers(body.takers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/attestation/takers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: text, test_ids: Array.from(chosen) }),
    });
    const body = (await res.json()) as AddResult & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not invite teachers");
      return;
    }
    setResult(body);
    const leftover = [...body.failed.map((f) => f.email), ...body.invalid];
    setText(leftover.join("\n"));
    await load();
  }

  async function remove(t: Taker, testId?: string) {
    const who = t.profile?.full_name ?? t.profile?.email ?? "this teacher";
    const last = !testId || t.test_ids.length <= 1;
    const what = testId ? `${label.get(testId) ?? "this test"} for ${who}` : `all tests for ${who}`;
    if (!confirm(`Remove ${what}?${last ? " They will no longer have Attestation access." : ""}`)) return;
    setError(null);
    const res = await fetch("/api/attestation/takers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testId ? { user_id: t.user_id, test_id: testId } : { user_id: t.user_id }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not remove");
      return;
    }
    await load();
  }

  const q = filter.trim().toLowerCase();
  const shown = (takers ?? []).filter(
    (t) =>
      (!q || `${t.profile?.full_name ?? ""} ${t.profile?.email ?? ""}`.toLowerCase().includes(q)) &&
      (!subjectFilter || t.test_ids.includes(subjectFilter)),
  );

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          Teachers invited to tests {takers && <span className="text-gray-500 font-normal">({takers.length})</span>}
        </p>
        <p className="text-xs text-gray-500">
          Each teacher gets an email. No account yet? The email creates one and opens their tests. Invite again to resend a link.
        </p>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm text-gray-700">
          1. Choose the subject{chosen.size === 1 ? "" : "s"} {chosen.size > 0 && <span className="text-gray-500">({chosen.size} chosen)</span>}
        </legend>
        {choices.length === 0 ? (
          <p className="text-sm text-gray-500">No published tests yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {choices.map((t) => (
              <label
                key={t.id}
                title={t.title}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm cursor-pointer ${
                  chosen.has(t.id) ? "bg-violet-600 border-violet-600 text-white" : "bg-white text-gray-700"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={chosen.has(t.id)} onChange={() => toggle(t.id)} />
                {t.subject}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="space-y-1">
        <p className="text-sm text-gray-700">2. Paste the teachers&apos; emails</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] items-start">
          <textarea
            aria-label="Teachers' emails"
            className="border rounded-md px-3 py-2 w-full text-sm min-h-[80px]"
            placeholder={"One per line, or separated by commas"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !text.trim() || chosen.size === 0}
            onClick={() => void add()}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
          >
            {busy ? "Inviting…" : "Invite"}
          </button>
        </div>
      </div>

      {result && (
        <div role="status" className="text-sm space-y-1">
          {result.added.length > 0 && (
            <p className="text-green-700">
              Invited {result.added.length}
              {result.created.length > 0 && ` (${result.created.length} new account${result.created.length === 1 ? "" : "s"} created)`}.
            </p>
          )}
          {result.emailed > 0 && <p className="text-green-700">Emails sent: {result.emailed}.</p>}
          {result.already.length > 0 && (
            <p className="text-gray-600">
              Already invited to these subjects: {result.already.length} — emailed again (with a fresh link if they have not set a password yet).
            </p>
          )}
          {result.managers.length > 0 && (
            <p className="text-gray-600">Managers or admins, who already see every test: {result.managers.join(", ")}.</p>
          )}
          {result.recentlySent.length > 0 && (
            <p className="text-gray-600">
              Not re-sent — a link went out less than 10 minutes ago: {result.recentlySent.join(", ")}.
            </p>
          )}
          {result.failed.length > 0 && (
            <div className="text-amber-700">
              <p>Problems (left in the box to try again):</p>
              <ul className="list-disc pl-5">
                {result.failed.map((f) => (
                  <li key={f.email}>
                    {f.email} — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.invalid.length > 0 && <p className="text-red-600">Not email addresses: {result.invalid.join(", ")}</p>}
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {takers && takers.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Search teachers"
              className="border rounded-md px-3 py-1.5 text-sm w-full md:w-72"
              placeholder="Search by name or email"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select
              aria-label="Filter by subject"
              className="border rounded-md px-2 py-1.5 text-sm"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="">All subjects</option>
              {choices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.subject}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <tbody>
                {shown.map((t) => (
                  <tr key={t.user_id} className="border-t first:border-t-0 align-top">
                    <td className="px-3 py-1.5">
                      <p>{t.profile?.full_name ?? "—"}</p>
                      <p className="text-gray-500 text-xs">{t.profile?.email}</p>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {t.test_ids.length === 0 && <span className="text-xs text-amber-700">No subjects — invite them to one</span>}
                        {t.test_ids.map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 text-xs">
                            {label.get(id) ?? "Deleted test"}
                            <button
                              type="button"
                              aria-label={`Remove ${label.get(id) ?? "test"}`}
                              className="text-violet-500 hover:text-red-600"
                              onClick={() => void remove(t, id)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      <button type="button" className="text-red-600 underline text-xs" onClick={() => void remove(t)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-gray-500">No teachers match.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
