"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ invited?: number; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    // Split by newline, comma, or semicolon
    const emails = input.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);

    const res = await fetch("/api/invitations/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, emails }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult({ invited: data.invited });
      setInput("");
      router.refresh();
    } else {
      setResult({ error: await res.text() });
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Email addresses
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          placeholder={"john@example.com\njane@example.com\nor paste a comma-separated list"}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">One per line, or separated by commas/semicolons.</p>
      </div>

      {result?.invited !== undefined && (
        <p className="text-sm text-green-600 font-medium">
          ✓ {result.invited} invitation{result.invited !== 1 ? "s" : ""} sent.
        </p>
      )}
      {result?.error && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
      >
        {loading ? "Sending…" : "Send invitations"}
      </button>
    </form>
  );
}
