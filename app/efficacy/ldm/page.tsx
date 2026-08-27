"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoreBadge } from "@/components/efficacy/score-segment";

interface Teacher {
  teacher_id: string;
  full_name: string;
  email: string;
}

interface ObservationSummary {
  id: string;
  teacher_id: string;
  lesson_number: number;
  grand_average: number | null;
  status: string;
  created_at: string;
}

export default function LdmDashboard() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [observations, setObservations] = useState<ObservationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/efficacy/ldm/teachers").then((r) => r.json()),
      fetch("/api/efficacy/ldm/observations").then((r) => r.json()),
    ])
      .then(([t, o]) => {
        setTeachers(Array.isArray(t) ? t : []);
        setObservations(Array.isArray(o) ? o : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  const draftCount = observations.filter((o) => o.status === "draft").length;
  const sentCount = observations.filter((o) => o.status === "sent").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LDM Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage your assigned teachers and observations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <div className="text-3xl font-bold text-blue-600">{teachers.length}</div>
          <div className="text-sm text-gray-500 mt-1">Assigned Teachers</div>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="text-3xl font-bold text-yellow-600">{draftCount}</div>
          <div className="text-sm text-gray-500 mt-1">Draft Observations</div>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="text-3xl font-bold text-green-600">{sentCount}</div>
          <div className="text-sm text-gray-500 mt-1">Sent Observations</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">My Teachers</h2>
          <Link
            href="/efficacy/ldm/observations"
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            New Observation
          </Link>
        </div>
        {teachers.length === 0 ? (
          <p className="text-gray-500 bg-white rounded-lg border p-6 text-center">
            No teachers assigned yet. Ask an admin to assign teachers to you.
          </p>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {teachers.map((t) => {
              const teacherObs = observations.filter((o) => o.teacher_id === t.teacher_id);
              const lastObs = teacherObs[0];
              return (
                <div key={t.teacher_id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{t.full_name || t.email}</div>
                    <div className="text-sm text-gray-500">{t.email}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="text-gray-500">{teacherObs.length} observations</div>
                      {lastObs && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">Last:</span>
                          <ScoreBadge value={lastObs.grand_average} />
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/efficacy/ldm/observations?teacher=${t.teacher_id}`}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      Observe
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {observations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Observations</h2>
          <div className="bg-white rounded-lg border divide-y">
            {observations.slice(0, 10).map((obs) => {
              const teacher = teachers.find((t) => t.teacher_id === obs.teacher_id);
              return (
                <Link
                  key={obs.id}
                  href={`/efficacy/ldm/observations?edit=${obs.id}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors block"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {teacher?.full_name || "Unknown"} — Lesson {obs.lesson_number}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(obs.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreBadge value={obs.grand_average} />
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        obs.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {obs.status}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/efficacy/ldm/competency"
          className="bg-white rounded-lg border p-5 hover:border-orange-300 transition-colors group"
        >
          <h3 className="font-semibold text-gray-900 group-hover:text-orange-700">Competency Evaluations</h3>
          <p className="text-sm text-gray-500 mt-1">Evaluate teacher leadership competencies</p>
        </Link>
        <Link
          href="/efficacy/ldm/chat"
          className="bg-white rounded-lg border p-5 hover:border-orange-300 transition-colors group"
        >
          <h3 className="font-semibold text-gray-900 group-hover:text-orange-700">Behavior Classification</h3>
          <p className="text-sm text-gray-500 mt-1">Classify observed teacher behaviors into competencies</p>
        </Link>
      </div>
    </div>
  );
}
