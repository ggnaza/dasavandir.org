"use client";
import { useState, useEffect, useCallback } from "react";

type ReminderType = "new_lesson" | "not_started" | "not_completed" | "custom";

interface Reminder {
  id?: string;
  type: ReminderType;
  days_after_publish?: number | null;
  send_at_date?: string | null;
  custom_subject?: string | null;
  custom_message?: string | null;
  is_active?: boolean;
}

interface CustomReminder {
  key: number;
  mode: "days" | "date";
  days: string;
  date: string;
  subject: string;
  message: string;
}

export function LessonReminders({
  lessonId,
  courseId,
}: {
  lessonId: string;
  courseId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);

  // Standard reminder toggles
  const [notStartedEnabled, setNotStartedEnabled] = useState(false);
  const [notStartedDays, setNotStartedDays] = useState("3");
  const [notCompletedEnabled, setNotCompletedEnabled] = useState(false);
  const [notCompletedDays, setNotCompletedDays] = useState("7");

  // Custom reminders
  const [customReminders, setCustomReminders] = useState<CustomReminder[]>([]);
  const [nextKey, setNextKey] = useState(0);

  const loadReminders = useCallback(async () => {
    const res = await fetch(`/api/lessons/reminders?lessonId=${lessonId}`);
    if (!res.ok) return;
    const data: Reminder[] = await res.json();

    for (const r of data) {
      if (r.type === "not_started") {
        setNotStartedEnabled(r.is_active !== false);
        setNotStartedDays(String(r.days_after_publish ?? 3));
      } else if (r.type === "not_completed") {
        setNotCompletedEnabled(r.is_active !== false);
        setNotCompletedDays(String(r.days_after_publish ?? 7));
      } else if (r.type === "custom") {
        setCustomReminders((prev) => [
          ...prev,
          {
            key: nextKey + prev.length,
            mode: r.send_at_date ? "date" : "days",
            days: String(r.days_after_publish ?? 5),
            date: r.send_at_date ?? "",
            subject: r.custom_subject ?? "",
            message: r.custom_message ?? "",
          },
        ]);
        setNextKey((k) => k + 1);
      }
    }

    setLoading(false);
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  async function handleSave() {
    setSaving(true);
    const reminders: Omit<Reminder, "id">[] = [];

    if (notStartedEnabled) {
      reminders.push({
        type: "not_started",
        days_after_publish: parseInt(notStartedDays) || 3,
        is_active: true,
      });
    }

    if (notCompletedEnabled) {
      reminders.push({
        type: "not_completed",
        days_after_publish: parseInt(notCompletedDays) || 7,
        is_active: true,
      });
    }

    for (const cr of customReminders) {
      reminders.push({
        type: "custom",
        days_after_publish: cr.mode === "days" ? parseInt(cr.days) || null : null,
        send_at_date: cr.mode === "date" ? cr.date || null : null,
        custom_subject: cr.subject || null,
        custom_message: cr.message || null,
        is_active: true,
      });
    }

    await fetch("/api/lessons/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, courseId, reminders }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleNotifyNow() {
    setNotifying(true);
    setNotifyResult(null);
    const res = await fetch("/api/lessons/notify-new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    if (res.ok) {
      const { sent } = await res.json();
      setNotifyResult(
        sent === 0
          ? "All enrolled learners have already been notified."
          : `Notified ${sent} learner${sent === 1 ? "" : "s"}.`
      );
    } else {
      setNotifyResult("Failed to send notifications.");
    }
    setNotifying(false);
  }

  function addCustomReminder() {
    setCustomReminders((prev) => [
      ...prev,
      { key: nextKey, mode: "days", days: "5", date: "", subject: "", message: "" },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeCustomReminder(key: number) {
    setCustomReminders((prev) => prev.filter((r) => r.key !== key));
  }

  function updateCustomReminder(key: number, patch: Partial<CustomReminder>) {
    setCustomReminders((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  if (loading) return null;

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Reminders</p>
          <p className="text-xs text-gray-400">Notify enrolled learners about this lesson.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium shrink-0"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save reminders"}
        </button>
      </div>

      {/* Notify now */}
      <div className="flex items-start gap-3 bg-white border rounded-lg p-3">
        <div className="flex-1">
          <p className="text-sm font-medium">Notify all enrolled learners now</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Sends an email + in-app notification about this lesson. Each learner is notified only once.
          </p>
          {notifyResult && (
            <p className="text-xs text-brand-700 font-medium mt-1">{notifyResult}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleNotifyNow}
          disabled={notifying}
          className="text-xs border border-brand-600 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 disabled:opacity-50 font-medium shrink-0"
        >
          {notifying ? "Sending…" : "Send now"}
        </button>
      </div>

      {/* Not started reminder */}
      <div className="flex items-start gap-3 bg-white border rounded-lg p-3">
        <input
          type="checkbox"
          id="not-started"
          checked={notStartedEnabled}
          onChange={(e) => setNotStartedEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600 shrink-0"
        />
        <label htmlFor="not-started" className="flex-1 cursor-pointer">
          <p className="text-sm font-medium">Remind learners who haven't started</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Sent to learners who have never opened this lesson.
          </p>
          {notStartedEnabled && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="1"
                max="90"
                value={notStartedDays}
                onChange={(e) => setNotStartedDays(e.target.value)}
                className="w-16 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-xs text-gray-500">days after lesson is added</span>
            </div>
          )}
        </label>
      </div>

      {/* Not completed reminder */}
      <div className="flex items-start gap-3 bg-white border rounded-lg p-3">
        <input
          type="checkbox"
          id="not-completed"
          checked={notCompletedEnabled}
          onChange={(e) => setNotCompletedEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600 shrink-0"
        />
        <label htmlFor="not-completed" className="flex-1 cursor-pointer">
          <p className="text-sm font-medium">Remind learners who haven't completed</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Sent to learners who haven't marked this lesson as done.
          </p>
          {notCompletedEnabled && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="1"
                max="90"
                value={notCompletedDays}
                onChange={(e) => setNotCompletedDays(e.target.value)}
                className="w-16 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-xs text-gray-500">days after lesson is added</span>
            </div>
          )}
        </label>
      </div>

      {/* Custom reminders */}
      {customReminders.map((cr, idx) => (
        <div key={cr.key} className="bg-white border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Custom reminder {idx + 1}</p>
            <button
              type="button"
              onClick={() => removeCustomReminder(cr.key)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>

          <div className="flex gap-1 bg-gray-100 border rounded-lg p-0.5 w-fit">
            {(["days", "date"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateCustomReminder(cr.key, { mode: m })}
                className={`text-xs px-3 py-1 rounded-md font-medium transition ${
                  cr.mode === m ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "days" ? "Days after lesson" : "Specific date"}
              </button>
            ))}
          </div>

          {cr.mode === "days" ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="365"
                value={cr.days}
                onChange={(e) => updateCustomReminder(cr.key, { days: e.target.value })}
                placeholder="e.g. 5"
                className="w-16 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-xs text-gray-500">days after lesson is added</span>
            </div>
          ) : (
            <input
              type="date"
              value={cr.date}
              onChange={(e) => updateCustomReminder(cr.key, { date: e.target.value })}
              className="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}

          <input
            type="text"
            value={cr.subject}
            onChange={(e) => updateCustomReminder(cr.key, { subject: e.target.value })}
            placeholder="Email subject (optional)"
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            value={cr.message}
            onChange={(e) => updateCustomReminder(cr.key, { message: e.target.value })}
            rows={2}
            placeholder="Custom message (optional)"
            className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addCustomReminder}
        className="text-xs text-brand-600 hover:underline font-medium"
      >
        + Add custom reminder
      </button>
    </div>
  );
}
