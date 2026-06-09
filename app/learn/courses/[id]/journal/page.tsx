"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

type Entry = { id: string; content: string; created_at: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function JournalPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reflections?courseId=${courseId}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [courseId]);

  async function save() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, content: draft.trim() }),
    });
    if (!res.ok) { setError("Failed to save. Please try again."); setSaving(false); return; }
    const entry: Entry = await res.json();
    setEntries((prev) => [entry, ...prev]);
    setDraft("");
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/reflections/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${courseId}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Back to course
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">My Reflection Journal</h1>
      <p className="text-sm text-gray-500 mb-6">
        A private space for your thoughts, insights, and professional growth notes. Only you can see this.
      </p>

      {/* New entry */}
      <div className="bg-white border rounded-xl p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">New reflection</p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What are you thinking about? What did you learn today? What challenged you?"
          rows={4}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        <div className="flex justify-end mt-3">
          <button
            onClick={save}
            disabled={!draft.trim() || saving}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save entry"}
          </button>
        </div>
      </div>

      {/* Past entries */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading entries…</p>
      ) : entries.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No entries yet. Write your first reflection above.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="bg-white border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <div>
                  <p className="text-xs text-gray-400">{formatDate(e.created_at)}</p>
                  <p className="text-sm text-gray-700 mt-0.5 line-clamp-1">{e.content}</p>
                </div>
                <span className="text-gray-400 ml-3 shrink-0">{expandedId === e.id ? "▲" : "▼"}</span>
              </button>
              {expandedId === e.id && (
                <div className="px-5 pb-4 border-t pt-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.content}</p>
                  <button
                    onClick={() => deleteEntry(e.id)}
                    className="text-xs text-red-400 hover:text-red-600 mt-3"
                  >
                    Delete entry
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
