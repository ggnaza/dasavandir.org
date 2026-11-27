"use client";

import { useCallback, useEffect, useState } from "react";

interface Taker {
  user_id: string;
  access: "member" | "ldm";
  granted_at: string;
  profile: { full_name: string | null; email: string | null } | null;
}
interface AddResult {
  added: string[];
  already: string[];
  notFound: string[];
  invalid: string[];
}

/** Managers add teachers by email; each added teacher can then open /attestation and take any published test. */
export function TakersPanel() {
  const [takers, setTakers] = useState<Taker[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/attestation/takers");
    const body = (await res.json()) as { takers?: Taker[]; error?: string };
    if (!res.ok) setError(body.error ?? "Could not load teachers");
    else setTakers(body.takers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/attestation/takers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: text }),
    });
    const body = (await res.json()) as AddResult & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not add teachers");
      return;
    }
    setResult(body);
    if (body.notFound.length === 0 && body.invalid.length === 0) setText("");
    else setText([...body.notFound, ...body.invalid].join("\n"));
    await load();
  }

  async function remove(t: Taker) {
    if (!confirm(`Remove ${t.profile?.full_name ?? t.profile?.email ?? "this teacher"} from attestation testing?`)) return;
    setError(null);
    const res = await fetch("/api/attestation/takers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: t.user_id }),
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
    (t) => !q || `${t.profile?.full_name ?? ""} ${t.profile?.email ?? ""}`.toLowerCase().includes(q),
  );
  const teacherCount = (takers ?? []).filter((t) => t.access === "member").length;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">Teachers who can take tests {takers && <span className="text-gray-500 font-normal">({teacherCount})</span>}</p>
        <p className="text-xs text-gray-500">They sign in at dasavandir.org and open Attestation from the top menu.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] items-start">
        <textarea
          className="border rounded-md px-3 py-2 w-full text-sm min-h-[80px]"
          placeholder={"Paste teachers' emails — one per line, or separated by commas"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void add()}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add teachers"}
        </button>
      </div>

      {result && (
        <div role="status" className="text-sm space-y-1">
          {result.added.length > 0 && <p className="text-green-700">Added {result.added.length}.</p>}
          {result.already.length > 0 && <p className="text-gray-600">Already had access: {result.already.length}.</p>}
          {result.notFound.length > 0 && (
            <p className="text-amber-700">
              No account yet for {result.notFound.length} (left in the box): they need to sign up at dasavandir.org first, then add them again.
            </p>
          )}
          {result.invalid.length > 0 && <p className="text-red-600">Not email addresses: {result.invalid.join(", ")}</p>}
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {takers && takers.length > 0 && (
        <>
          {takers.length > 8 && (
            <input
              className="border rounded-md px-3 py-1.5 text-sm w-full md:w-72"
              placeholder="Search by name or email"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
          <div className="max-h-72 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <tbody>
                {shown.map((t) => (
                  <tr key={t.user_id} className="border-t first:border-t-0">
                    <td className="px-3 py-1.5">{t.profile?.full_name ?? "—"}</td>
                    <td className="px-3 py-1.5 text-gray-500">{t.profile?.email}</td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {t.access === "ldm" ? (
                        <span className="text-xs text-violet-700">Manager</span>
                      ) : (
                        <button type="button" className="text-red-600 underline text-xs" onClick={() => void remove(t)}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
