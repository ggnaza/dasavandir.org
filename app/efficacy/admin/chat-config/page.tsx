"use client";
import { useEffect, useState } from "react";

interface ChatConfig {
  plan_instructions: string;
  delivery_instructions: string;
}

export default function ChatConfigPage() {
  const [config, setConfig] = useState<ChatConfig>({
    plan_instructions: "",
    delivery_instructions: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/efficacy/admin/chat-configs")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object") {
          setConfig({
            plan_instructions: data.plan_instructions ?? "",
            delivery_instructions: data.delivery_instructions ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/efficacy/admin/chat-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage({ type: "success", text: "Chat configuration saved" });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Chat Configuration</h1>
        <p className="text-gray-600 mt-1">
          Configure the AI coaching playbooks for plan review and delivery evaluation chats
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-gray-900 mb-2">Plan Review Chat Instructions</h2>
          <p className="text-sm text-gray-500 mb-3">
            System prompt for the AI coach when reviewing lesson plans. Leave empty for default behavior.
          </p>
          <textarea
            value={config.plan_instructions}
            onChange={(e) => setConfig((c) => ({ ...c, plan_instructions: e.target.value }))}
            rows={10}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-y font-mono"
            placeholder="Custom system instructions for plan review..."
          />
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-2">Delivery Evaluation Chat Instructions</h2>
          <p className="text-sm text-gray-500 mb-3">
            System prompt for the AI coach when walking through a delivery evaluation.
          </p>
          <textarea
            value={config.delivery_instructions}
            onChange={(e) => setConfig((c) => ({ ...c, delivery_instructions: e.target.value }))}
            rows={10}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-y font-mono"
            placeholder="Custom system instructions for delivery evaluation..."
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
