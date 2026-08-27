"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Stepper } from "@/components/efficacy/stepper";
import {
  TeachingRubricEditor,
  emptyTeachingRubric,
} from "@/components/efficacy/teaching-rubric-editor";
import type { TeachingRubricData } from "@/components/efficacy/teaching-rubric-editor";
import { FlatRubricEditor, emptyFlatRubric } from "@/components/efficacy/flat-rubric-editor";
import type { FlatRubricData } from "@/components/efficacy/flat-rubric-editor";
import { ScoreBadge } from "@/components/efficacy/score-segment";
import {
  PLANNING_RUBRIC_CRITERIA,
  OVERALL_EXPECTATIONS_CRITERIA,
  TIMELINE_PHASES,
} from "@/lib/efficacy/rubrics";

interface Teacher {
  teacher_id: string;
  full_name: string;
  email: string;
}

interface TimelineRow {
  phase: string;
  teacherActions: string;
  studentActions: string;
  questionsObservations: string;
}

interface GoalRow {
  goal: string;
  steps: string;
}

interface ObservationForm {
  teacherId: string;
  lessonNumber: number;
  subject: string;
  grade: string;
  lessonPlanLink: string;
  recordingLink: string;
  planningRubric: FlatRubricData;
  timeline: TimelineRow[];
  teachingRubric: TeachingRubricData;
  coaching: {
    feltAtStart: string;
    selfReflectionSummary: string;
    strengthsObserved: string;
    improvementsObserved: string;
    questionsForTeacher: string;
    practicalWorkPlan: string;
    feltAtEnd: string;
    goals: GoalRow[];
    resourcesAndGuidance: string;
  };
  overallExpectations: FlatRubricData;
}

const STEPS = [
  "Data",
  "A. Planning",
  "B. Timeline",
  "C. Teaching",
  "D. Coaching",
  "E. Overall",
];

function emptyTimeline(): TimelineRow[] {
  return TIMELINE_PHASES.map((phase) => ({
    phase,
    teacherActions: "",
    studentActions: "",
    questionsObservations: "",
  }));
}

function emptyGoals(): GoalRow[] {
  return [
    { goal: "", steps: "" },
    { goal: "", steps: "" },
    { goal: "", steps: "" },
  ];
}

function emptyForm(): ObservationForm {
  return {
    teacherId: "",
    lessonNumber: 1,
    subject: "",
    grade: "",
    lessonPlanLink: "",
    recordingLink: "",
    planningRubric: emptyFlatRubric(PLANNING_RUBRIC_CRITERIA),
    timeline: emptyTimeline(),
    teachingRubric: emptyTeachingRubric(),
    coaching: {
      feltAtStart: "",
      selfReflectionSummary: "",
      strengthsObserved: "",
      improvementsObserved: "",
      questionsForTeacher: "",
      practicalWorkPlan: "",
      feltAtEnd: "",
      goals: emptyGoals(),
      resourcesAndGuidance: "",
    },
    overallExpectations: emptyFlatRubric(OVERALL_EXPECTATIONS_CRITERIA),
  };
}

export default function ObservationPage() {
  const searchParams = useSearchParams();
  const preselectedTeacher = searchParams.get("teacher");
  const editId = searchParams.get("edit");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ObservationForm>(emptyForm);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(editId);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/efficacy/ldm/teachers")
      .then((r) => r.json())
      .then((data) => {
        setTeachers(Array.isArray(data) ? data : []);
        if (preselectedTeacher) {
          setForm((f) => ({ ...f, teacherId: preselectedTeacher }));
        }
      });

    if (editId) {
      fetch(`/api/efficacy/ldm/observations/${editId}`)
        .then((r) => r.json())
        .then((obs) => {
          if (obs && obs.id) {
            setForm({
              teacherId: obs.teacher_id ?? "",
              lessonNumber: obs.lesson_number ?? 1,
              subject: obs.subject ?? "",
              grade: obs.grade ?? "",
              lessonPlanLink: obs.lesson_plan_link ?? "",
              recordingLink: obs.recording_link ?? "",
              planningRubric: obs.planning_rubric ?? emptyFlatRubric(PLANNING_RUBRIC_CRITERIA),
              timeline: obs.timeline ?? emptyTimeline(),
              teachingRubric: obs.teaching_rubric ?? emptyTeachingRubric(),
              coaching: obs.coaching ?? {
                feltAtStart: "",
                selfReflectionSummary: "",
                strengthsObserved: "",
                improvementsObserved: "",
                questionsForTeacher: "",
                practicalWorkPlan: "",
                feltAtEnd: "",
                goals: emptyGoals(),
                resourcesAndGuidance: "",
              },
              overallExpectations: obs.overall_expectations ?? emptyFlatRubric(OVERALL_EXPECTATIONS_CRITERIA),
            });
            setSavedId(obs.id);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [editId, preselectedTeacher]);

  const computeGrandAverage = useCallback(() => {
    const avgs = [
      form.planningRubric.overallAverage,
      form.teachingRubric.overallAverage,
      form.overallExpectations.overallAverage,
    ].filter((n): n is number => n !== null);
    return avgs.length > 0
      ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100
      : null;
  }, [form.planningRubric.overallAverage, form.teachingRubric.overallAverage, form.overallExpectations.overallAverage]);

  async function handleSave() {
    if (!form.teacherId) {
      setMessage({ type: "error", text: "Please select a teacher" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const body = {
        ...(savedId ? { id: savedId } : {}),
        teacher_id: form.teacherId,
        lesson_number: form.lessonNumber,
        subject: form.subject,
        grade: form.grade,
        lesson_plan_link: form.lessonPlanLink,
        recording_link: form.recordingLink,
        planning_rubric: form.planningRubric,
        timeline: form.timeline,
        teaching_rubric: form.teachingRubric,
        coaching: form.coaching,
        overall_expectations: form.overallExpectations,
      };
      const res = await fetch("/api/efficacy/ldm/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedId(data.id);
      setMessage({ type: "success", text: "Observation saved" });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!savedId) {
      setMessage({ type: "error", text: "Save the observation first" });
      return;
    }
    try {
      const res = await fetch(`/api/efficacy/ldm/observations/${savedId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessage({ type: "success", text: "Observation sent to teacher" });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Send failed" });
    }
  }

  function updateCoaching(field: string, value: string) {
    setForm((f) => ({
      ...f,
      coaching: { ...f.coaching, [field]: value },
    }));
  }

  function updateGoal(idx: number, field: keyof GoalRow, value: string) {
    setForm((f) => {
      const goals = f.coaching.goals.map((g, i) =>
        i === idx ? { ...g, [field]: value } : g
      );
      return { ...f, coaching: { ...f.coaching, goals } };
    });
  }

  function updateTimeline(idx: number, field: keyof TimelineRow, value: string) {
    setForm((f) => {
      const timeline = f.timeline.map((t, i) =>
        i === idx ? { ...t, [field]: value } : t
      );
      return { ...f, timeline };
    });
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  const grandAvg = computeGrandAverage();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lesson Observation</h1>
          {grandAvg !== null && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">Grand Average:</span>
              <span className="text-lg"><ScoreBadge value={grandAvg} /></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {savedId && (
            <button
              onClick={handleSend}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Send to Teacher
            </button>
          )}
        </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
              <select
                value={form.teacherId}
                onChange={(e) => setForm((f) => ({ ...f, teacherId: e.target.value }))}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Plan Link</label>
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
        <FlatRubricEditor
          title="A. Planning Rubric"
          value={form.planningRubric}
          onChange={(v) => setForm((f) => ({ ...f, planningRubric: v }))}
        />
      )}

      {step === 2 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">B. Lesson Timeline</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-gray-700 w-1/4">Phase</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Teacher Actions</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Student Actions</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">Questions / Observations</th>
                </tr>
              </thead>
              <tbody>
                {form.timeline.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2 px-2 font-medium text-gray-700 align-top">{row.phase}</td>
                    <td className="py-2 px-2">
                      <textarea
                        value={row.teacherActions}
                        onChange={(e) => updateTimeline(idx, "teacherActions", e.target.value)}
                        rows={3}
                        className="w-full border rounded px-2 py-1 text-sm resize-y"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <textarea
                        value={row.studentActions}
                        onChange={(e) => updateTimeline(idx, "studentActions", e.target.value)}
                        rows={3}
                        className="w-full border rounded px-2 py-1 text-sm resize-y"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <textarea
                        value={row.questionsObservations}
                        onChange={(e) => updateTimeline(idx, "questionsObservations", e.target.value)}
                        rows={3}
                        className="w-full border rounded px-2 py-1 text-sm resize-y"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">C. Teaching Rubric</h2>
          <TeachingRubricEditor
            value={form.teachingRubric}
            onChange={(v) => setForm((f) => ({ ...f, teachingRubric: v }))}
          />
        </div>
      )}

      {step === 4 && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">D. Coaching Notes</h2>
          {[
            { key: "feltAtStart", label: "How did you feel at the start?" },
            { key: "selfReflectionSummary", label: "Teacher's self-reflection summary" },
            { key: "strengthsObserved", label: "Strengths observed" },
            { key: "improvementsObserved", label: "Areas for improvement" },
            { key: "questionsForTeacher", label: "Questions for the teacher" },
            { key: "practicalWorkPlan", label: "Practical work plan" },
            { key: "feltAtEnd", label: "How did you feel at the end?" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <textarea
                value={(form.coaching as unknown as Record<string, string>)[key] ?? ""}
                onChange={(e) => updateCoaching(key, e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-y"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Goals</label>
            <div className="space-y-3">
              {form.coaching.goals.map((g, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-3">
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
                    placeholder="Steps"
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resources & Guidance</label>
            <textarea
              value={form.coaching.resourcesAndGuidance}
              onChange={(e) => updateCoaching("resourcesAndGuidance", e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-y"
            />
          </div>
        </div>
      )}

      {step === 5 && (
        <FlatRubricEditor
          title="E. Overall Expectations"
          value={form.overallExpectations}
          onChange={(v) => setForm((f) => ({ ...f, overallExpectations: v }))}
        />
      )}

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-30 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
