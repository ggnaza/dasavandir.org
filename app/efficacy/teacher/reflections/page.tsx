"use client";
import { useState } from "react";
import { Stepper } from "@/components/efficacy/stepper";
import { TeachingRubricEditor, emptyTeachingRubric } from "@/components/efficacy/teaching-rubric-editor";
import type { TeachingRubricData } from "@/components/efficacy/teaching-rubric-editor";

interface GoalRow {
  goal: string;
  steps: string;
}

interface ReflectionForm {
  lessonNumber: number;
  academicYear: string;
  subject: string;
  topic: string;
  grade: string;
  studentsCount: number;
  lessonPlanLink: string;
  recordingLink: string;
  successfulDirections: string;
  previousGoalsProgress: string;
  selfAssessment: TeachingRubricData;
  goals: GoalRow[];
}

const STEPS = ["Lesson Data", "Reflection", "Self-Assessment", "Goals & Save"];

function emptyGoals(): GoalRow[] {
  return [
    { goal: "", steps: "" },
    { goal: "", steps: "" },
    { goal: "", steps: "" },
  ];
}

export default function ReflectionPage() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<ReflectionForm>({
    lessonNumber: 1,
    academicYear: "2025-2026",
    subject: "",
    topic: "",
    grade: "",
    studentsCount: 0,
    lessonPlanLink: "",
    recordingLink: "",
    successfulDirections: "",
    previousGoalsProgress: "",
    selfAssessment: emptyTeachingRubric(),
    goals: emptyGoals(),
  });

  function updateGoal(idx: number, field: keyof GoalRow, value: string) {
    setForm((f) => ({
      ...f,
      goals: f.goals.map((g, i) => (i === idx ? { ...g, [field]: value } : g)),
    }));
  }

  async function handleSubmit() {
    if (!form.lessonPlanLink) {
      setMessage({ type: "error", text: "Lesson plan link is required" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/efficacy/teacher/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_number: form.lessonNumber,
          academic_year: form.academicYear,
          subject: form.subject,
          topic: form.topic,
          grade: form.grade,
          students_count: form.studentsCount,
          lesson_plan_link: form.lessonPlanLink,
          recording_link: form.recordingLink,
          successful_directions: form.successfulDirections,
          previous_goals_progress: form.previousGoalsProgress,
          self_assessment: form.selfAssessment,
          goals: form.goals,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage({ type: "success", text: "Reflection saved successfully" });
      setForm({
        ...form,
        lessonNumber: form.lessonNumber + 1,
        topic: "",
        successfulDirections: "",
        previousGoalsProgress: "",
        selfAssessment: emptyTeachingRubric(),
        goals: emptyGoals(),
      });
      setStep(0);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Self-Reflection</h1>
        <p className="text-gray-600 mt-1">Reflect on your lesson and set goals for improvement</p>
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

      <Stepper steps={STEPS} current={step} onSelect={setStep} />

      {step === 0 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Lesson Data</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lesson #</label>
              <input
                type="number"
                min={1}
                value={form.lessonNumber}
                onChange={(e) => setForm((f) => ({ ...f, lessonNumber: parseInt(e.target.value) || 1 }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input
                type="text"
                value={form.academicYear}
                onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
              <input
                type="text"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Students</label>
              <input
                type="number"
                min={0}
                value={form.studentsCount}
                onChange={(e) => setForm((f) => ({ ...f, studentsCount: parseInt(e.target.value) || 0 }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Plan Link *</label>
              <input
                type="url"
                value={form.lessonPlanLink}
                onChange={(e) => setForm((f) => ({ ...f, lessonPlanLink: e.target.value }))}
                placeholder="https://docs.google.com/..."
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recording Link</label>
              <input
                type="url"
                value={form.recordingLink}
                onChange={(e) => setForm((f) => ({ ...f, recordingLink: e.target.value }))}
                placeholder="https://..."
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Self-Reflection Questions</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What were the successful directions of this lesson?
            </label>
            <textarea
              value={form.successfulDirections}
              onChange={(e) => setForm((f) => ({ ...f, successfulDirections: e.target.value }))}
              rows={5}
              className="w-full border rounded-lg px-3 py-2 resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How did you progress on your previous goals?
            </label>
            <textarea
              value={form.previousGoalsProgress}
              onChange={(e) => setForm((f) => ({ ...f, previousGoalsProgress: e.target.value }))}
              rows={5}
              className="w-full border rounded-lg px-3 py-2 resize-y"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Self-Assessment</h2>
          <TeachingRubricEditor
            value={form.selfAssessment}
            onChange={(v) => setForm((f) => ({ ...f, selfAssessment: v }))}
          />
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Goals for Next Lesson</h2>
          <div className="space-y-3">
            {form.goals.map((g, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={g.goal}
                  onChange={(e) => updateGoal(idx, "goal", e.target.value)}
                  placeholder={`Goal ${idx + 1}`}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={g.steps}
                  onChange={(e) => updateGoal(idx, "steps", e.target.value)}
                  placeholder="Steps to achieve"
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="mt-4 px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Reflection"}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
