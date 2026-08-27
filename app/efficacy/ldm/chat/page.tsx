"use client";
import { useEffect, useState, useRef } from "react";
import { COMPETENCY_CATEGORIES } from "@/lib/efficacy/constants";

interface Teacher {
  teacher_id: string;
  full_name: string;
  email: string;
}

interface Manifestation {
  id: string;
  competency: string;
  category: string;
  text: string;
  created_at: string;
}

interface GroupedManifestations {
  category: string;
  categoryName: string;
  items: { competency: string; manifestations: Manifestation[] }[];
}

function groupManifestations(items: Manifestation[]): GroupedManifestations[] {
  const groups: GroupedManifestations[] = [];
  for (const cat of COMPETENCY_CATEGORIES) {
    const catItems = items.filter((m) => m.category === cat.key);
    if (catItems.length === 0) continue;
    const byComp: Record<string, Manifestation[]> = {};
    for (const m of catItems) {
      (byComp[m.competency] ??= []).push(m);
    }
    groups.push({
      category: cat.key,
      categoryName: cat.name,
      items: Object.entries(byComp).map(([comp, mans]) => ({
        competency: comp,
        manifestations: mans,
      })),
    });
  }
  return groups;
}

export default function BehaviorChatPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [period, setPeriod] = useState("");
  const [manifestations, setManifestations] = useState<Manifestation[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLog, setChatLog] = useState<{ role: "user" | "ai"; text: string; competency?: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/efficacy/ldm/teachers")
      .then((r) => r.json())
      .then((data) => setTeachers(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    if (!selectedTeacher) return;
    const params = new URLSearchParams({ teacher_id: selectedTeacher });
    if (period) params.set("period", period);
    fetch(`/api/efficacy/ai/manifestations?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setManifestations(data);
      });
  }, [selectedTeacher, period]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedTeacher || sending) return;
    const text = input.trim();
    setInput("");
    setChatLog((prev) => [...prev, { role: "user", text }]);
    setSending(true);
    try {
      const res = await fetch("/api/efficacy/ai/manifestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: selectedTeacher,
          period: period || undefined,
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Classification failed");
      setChatLog((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Classified as: ${data.competency} (${data.category})`,
          competency: data.competency,
        },
      ]);
      setManifestations((prev) => [data, ...prev]);
    } catch (e) {
      setChatLog((prev) => [
        ...prev,
        { role: "ai", text: `Error: ${e instanceof Error ? e.message : "Failed"}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  const grouped = groupManifestations(manifestations);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Behavior Classification</h1>
        <p className="text-gray-600 mt-1">
          Describe observed teacher behaviors and AI will classify them into leadership competencies
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Select teacher...</option>
            {teachers.map((t) => (
              <option key={t.teacher_id} value={t.teacher_id}>
                {t.full_name || t.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="e.g. Q1 2026"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {selectedTeacher && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chat panel */}
          <div className="bg-white rounded-lg border flex flex-col" style={{ minHeight: 400 }}>
            <div className="p-3 border-b bg-gray-50 rounded-t-lg">
              <span className="text-sm font-medium text-gray-700">Chat</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 500 }}>
              {chatLog.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-8">
                  Describe a teacher behavior you observed...
                </p>
              )}
              {chatLog.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-500 rounded-lg px-3 py-2 text-sm">
                    Classifying...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe an observed behavior..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            </form>
          </div>

          {/* Grouped manifestations panel */}
          <div className="bg-white rounded-lg border" style={{ minHeight: 400 }}>
            <div className="p-3 border-b bg-gray-50 rounded-t-lg">
              <span className="text-sm font-medium text-gray-700">
                Classified Behaviors ({manifestations.length})
              </span>
            </div>
            <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: 550 }}>
              {grouped.length === 0 && (
                <p className="text-sm text-gray-400 text-center mt-8">
                  No behaviors classified yet
                </p>
              )}
              {grouped.map((group) => (
                <div key={group.category}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{group.categoryName}</h3>
                  {group.items.map(({ competency, manifestations: mans }) => (
                    <div key={competency} className="mb-3 ml-2">
                      <div className="text-xs font-medium text-orange-700 mb-1">
                        {competency} ({mans.length})
                      </div>
                      <div className="space-y-1">
                        {mans.map((m) => (
                          <div key={m.id} className="text-xs text-gray-600 pl-2 border-l border-gray-200">
                            {m.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
