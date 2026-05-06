"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CourseReminders({
  courseId,
  initialNotifyOnNewLesson,
  initialNotStartedDays,
  initialNotCompletedDays,
}: {
  courseId: string;
  initialNotifyOnNewLesson: boolean;
  initialNotStartedDays: number | null;
  initialNotCompletedDays: number | null;
}) {
  const [notifyOnNew, setNotifyOnNew] = useState(initialNotifyOnNewLesson);
  const [notStartedEnabled, setNotStartedEnabled] = useState(initialNotStartedDays !== null);
  const [notStartedDays, setNotStartedDays] = useState(String(initialNotStartedDays ?? 3));
  const [notCompletedEnabled, setNotCompletedEnabled] = useState(initialNotCompletedDays !== null);
  const [notCompletedDays, setNotCompletedDays] = useState(String(initialNotCompletedDays ?? 7));

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("courses")
      .update({
        notify_on_new_lesson: notifyOnNew,
        remind_not_started_days: notStartedEnabled ? parseInt(notStartedDays) || null : null,
        remind_not_completed_days: notCompletedEnabled ? parseInt(notCompletedDays) || null : null,
      })
      .eq("id", courseId);
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
      body: JSON.stringify({ courseId }),
    });
    if (res.ok) {
      const { sent, lessonTitle } = await res.json();
      setNotifyResult(
        sent === 0
          ? "All enrolled learners have already been notified about the latest lesson."
          : `Notified ${sent} learner${sent === 1 ? "" : "s"} about "${lessonTitle}".`
      );
    } else {
      setNotifyResult("Failed to send notifications.");
    }
    setNotifying(false);
  }

  return (
    <div className="border rounded-xl p-4 space-y-4 bg-gray-50 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Reminders</p>
          <p className="text-xs text-gray-400">
            Automated emails sent to enrolled learners. Applies to all lessons in this course.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium shrink-0"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {/* Notify about new lessons */}
      <div className="bg-white border rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="notify-new"
            checked={notifyOnNew}
            onChange={(e) => setNotifyOnNew(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600 shrink-0"
          />
          <label htmlFor="notify-new" className="flex-1 cursor-pointer">
            <p className="text-sm font-medium">Notify enrolled learners when a new lesson is added</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Sends an email + in-app notification the moment a new lesson is published.
            </p>
          </label>
        </div>
        <div className="pl-7">
          <p className="text-xs text-gray-400 mb-1.5">
            Or notify manually about the latest lesson:
          </p>
          <button
            type="button"
            onClick={handleNotifyNow}
            disabled={notifying}
            className="text-xs border border-brand-500 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 disabled:opacity-50 font-medium"
          >
            {notifying ? "Sending…" : "Send notification now"}
          </button>
          {notifyResult && (
            <p className="text-xs text-brand-700 font-medium mt-1.5">{notifyResult}</p>
          )}
        </div>
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
          <p className="text-sm font-medium">Remind learners who haven't started a lesson</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Sent to learners who have never opened a lesson after it is added.
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
              <span className="text-xs text-gray-500">days after the lesson is added</span>
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
          <p className="text-sm font-medium">Remind learners who haven't completed a lesson</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Sent to learners who haven't marked a lesson as done.
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
              <span className="text-xs text-gray-500">days after the lesson is added</span>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}
