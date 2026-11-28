"use client";

import { useCallback, useEffect, useState } from "react";

interface Manager {
  user_id: string;
  granted_at: string;
  profile: { full_name: string | null; email: string | null } | null;
}
interface AddResult {
  added: string[];
  already: string[];
  notFound: string[];
  invalid: string[];
}

/**
 * Admins add and remove attestation managers. Managers build tests, invite
 * teachers and see results. The panel renders nothing for non-admins (the API
 * answers them 403), so managers cannot appoint managers (ADR-0011).
 */
export function ManagersPanel() {
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/attestation/managers");
    if (res.status === 403) {
      setHidden(true);
      return;
    }
    const body = (await res.json()) as { managers?: Manager[]; error?: string };
    if (!res.ok) setError(body.error ?? "Could not load managers");
    else setManagers(body.managers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/attestation/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: text }),
    });
    const body = (await res.json()) as AddResult & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not add managers");
      return;
    }
    setResult(body);
    if (body.notFound.length === 0 && body.invalid.length === 0) setText("");
    else setText([...body.notFound, ...body.invalid].join("\n"));
    await load();
  }

  async function remove(m: Manager) {
    const who = m.profile?.full_name ?? m.profile?.email ?? "this manager";
    if (!confirm(`Remove ${who} as an attestation manager? They will lose Attestation access.`)) return;
    setError(null);
    const res = await fetch("/api/attestation/managers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: m.user_id }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not remove");
      return;
    }
    await load();
  }

  if (hidden) return null;

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          Managers {managers && <span className="text-gray-500 font-normal">({managers.length})</span>}
        </p>
        <p className="text-xs text-gray-500">Managers edit tests and keys, invite teachers and see all results. Only admins see this panel.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] items-start">
        <textarea
          aria-label="Managers' emails"
          className="border rounded-md px-3 py-2 w-full text-sm min-h-[60px]"
          placeholder="Paste emails — one per line, or separated by commas"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void add()}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add managers"}
        </button>
      </div>

      {result && (
        <div role="status" className="text-sm space-y-1">
          {result.added.length > 0 && <p className="text-green-700">Added {result.added.length}.</p>}
          {result.already.length > 0 && <p className="text-gray-600">Already a manager or admin: {result.already.length}.</p>}
          {result.notFound.length > 0 && (
            <p className="text-amber-700">
              No account yet for {result.notFound.length} (left in the box): they need to sign up at dasavandir.org first.
            </p>
          )}
          {result.invalid.length > 0 && <p className="text-red-600">Not email addresses: {result.invalid.join(", ")}</p>}
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {managers && managers.length > 0 && (
        <div className="border rounded-lg">
          <table className="w-full text-sm">
            <tbody>
              {managers.map((m) => (
                <tr key={m.user_id} className="border-t first:border-t-0">
                  <td className="px-3 py-1.5">{m.profile?.full_name ?? "—"}</td>
                  <td className="px-3 py-1.5 text-gray-500">{m.profile?.email}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button type="button" className="text-red-600 underline text-xs" onClick={() => void remove(m)}>
                      Remove
                    </button>
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
