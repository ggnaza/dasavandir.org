"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/efficacy/score-segment";

interface Observation {
  id: string;
  lesson_number: number;
  subject: string;
  grand_average: number | null;
  created_at: string;
  ldm_name?: string;
}

interface Reflection {
  id: string;
  lesson_number: number;
  subject: string;
  topic: string;
  created_at: string;
}

interface Evaluation {
  id: string;
  period: string;
  average_score: number | null;
  created_at: string;
}

export default function TeacherDashboard() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/efficacy/teacher/observations").then((r) => r.json()),
      fetch("/api/efficacy/teacher/reflections").then((r) => r.json()),
      fetch("/api/efficacy/teacher/evaluations").then((r) => r.json()),
    ])
      .then(([obs, refs, evals]) => {
        setObservations(Array.isArray(obs) ? obs : []);
        setReflections(Array.isArray(refs) ? refs : []);
        setEvaluations(Array.isArray(evals) ? evals : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-600 mt-1">Your observations, reflections, and evaluations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <div className="text-3xl font-bold text-blue-600">{observations.length}</div>
          <div className="text-sm text-gray-500 mt-1">Received Observations</div>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="text-3xl font-bold text-green-600">{reflections.length}</div>
          <div className="text-sm text-gray-500 mt-1">My Reflections</div>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="text-3xl font-bold text-purple-600">{evaluations.length}</div>
          <div className="text-sm text-gray-500 mt-1">Competency Evaluations</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/efficacy/teacher/reflections"
          className="bg-white rounded-lg border p-5 hover:border-orange-300 transition-colors group"
        >
          <h3 className="font-semibold text-gray-900 group-hover:text-orange-700">New Reflection</h3>
          <p className="text-sm text-gray-500 mt-1">Create a self-reflection for your latest lesson</p>
        </Link>
        <Link
          href="/efficacy/teacher/coach"
          className="bg-white rounded-lg border p-5 hover:border-orange-300 transition-colors group"
        >
          <h3 className="font-semibold text-gray-900 group-hover:text-orange-700">AI Coach</h3>
          <p className="text-sm text-gray-500 mt-1">Get AI coaching on your lesson plan</p>
        </Link>
      </div>

      {observations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Received Observations</h2>
          <div className="bg-white rounded-lg border divide-y">
            {observations.map((obs) => (
              <Link
                key={obs.id}
                href={`/efficacy/teacher?obs=${obs.id}`}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors block"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    Lesson {obs.lesson_number} — {obs.subject || "No subject"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(obs.created_at).toLocaleDateString()}
                    {obs.ldm_name && ` by ${obs.ldm_name}`}
                  </div>
                </div>
                <ScoreBadge value={obs.grand_average} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {reflections.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Reflections</h2>
          <div className="bg-white rounded-lg border divide-y">
            {reflections.map((ref) => (
              <div key={ref.id} className="p-4">
                <div className="font-medium text-gray-900">
                  Lesson {ref.lesson_number} — {ref.topic || ref.subject || "No topic"}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(ref.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {evaluations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Competency Evaluations</h2>
          <div className="bg-white rounded-lg border divide-y">
            {evaluations.map((ev) => (
              <div key={ev.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{ev.period || "No period"}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </div>
                </div>
                <ScoreBadge value={ev.average_score} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
