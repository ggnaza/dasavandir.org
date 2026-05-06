"use client";

import { useEffect, useState } from "react";

const MODELS = [
  { id: "gpt-4o-mini",                    label: "GPT-4o mini",      note: "Fast & affordable (OpenAI)" },
  { id: "gemini-2.0-flash",               label: "Gemini 2.0 Flash", note: "Fast (Google)" },
  { id: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash", note: "Smarter, fast (Google)" },
  { id: "gemini-2.5-pro-preview-05-06",   label: "Gemini 2.5 Pro",   note: "Most capable (Google)" },
] as const;

export default function SettingsPage() {
  const [model, setModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.ai_coach_model) setModel(d.settings.ai_coach_model);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_coach_model: model }),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json();
      setError(d.error || "Failed to save");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold mb-1">AI Coach Model</h2>
          <p className="text-sm text-gray-500 mb-4">
            Applies to all learners. Choose the model that balances quality and cost for your needs.
          </p>

          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="space-y-2">
              {MODELS.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    model === m.id ? "border-brand-500 bg-orange-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={model === m.id}
                    onChange={() => setModel(m.id)}
                    className="accent-orange-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.label}</p>
                    <p className="text-xs text-gray-500">{m.note}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || loading}
            className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "#EC5328" }}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
