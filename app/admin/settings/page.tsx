"use client";

import { useEffect, useState } from "react";
import { AI_MODELS } from "@/lib/llm";

const PROVIDER_ORDER = ["OpenAI", "Google", "Anthropic"];

const grouped = PROVIDER_ORDER.map((provider) => ({
  provider,
  models: AI_MODELS.filter((m) => m.provider === provider),
}));

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
        if (d.settings?.ai_model) setModel(d.settings.ai_model);
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
      body: JSON.stringify({ ai_model: model }),
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
          <h2 className="text-base font-semibold mb-1">AI Model</h2>
          <p className="text-sm text-gray-500 mb-4">
            Applies to all AI features — AI coach, quiz generation, assignment generation, course builder, submission grading, and more.
          </p>

          {loading ? (
            <div className="text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ provider, models }) => (
                <div key={provider}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{provider}</p>
                  <div className="space-y-1.5">
                    {models.map((m) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                          model === m.id ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="model"
                          value={m.id}
                          checked={model === m.id}
                          onChange={() => setModel(m.id)}
                          className="accent-brand-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.label}</p>
                          <p className="text-xs text-gray-500">{m.note}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || loading}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
