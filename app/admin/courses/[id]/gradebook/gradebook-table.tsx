"use client";
import { useState } from "react";

type LessonScore = {
  lessonId: string;
  lessonTitle: string;
  completed: boolean;
  quizScore: number | null;
  assignmentScore: number | null;
  maxScore: number | null;
  submissionStatus: string | null;
};

type Student = {
  userId: string;
  name: string;
  email: string;
  lessonScores: LessonScore[];
  avgQuiz: number | null;
  avgAssignment: number | null;
  overallScore: number | null;
  completedCount: number;
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300">—</span>;
  const color = score >= 80 ? "text-green-600 bg-green-50" : score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{score}%</span>;
}

export function GradebookTable({ students }: { students: Student[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <span className="col-span-4">Student</span>
        <span className="col-span-2 text-center">Quiz avg</span>
        <span className="col-span-2 text-center">Assignment avg</span>
        <span className="col-span-2 text-center">Overall</span>
        <span className="col-span-2 text-center">Completion</span>
      </div>

      {students.map((student) => (
        <div key={student.userId} className="border-t">
          {/* Student row */}
          <button
            onClick={() => setExpanded(expanded === student.userId ? null : student.userId)}
            className="w-full grid grid-cols-12 gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors items-center"
          >
            <div className="col-span-4">
              <p className="text-sm font-medium text-gray-900">{student.name}</p>
              <p className="text-xs text-gray-400">{student.email}</p>
            </div>
            <div className="col-span-2 text-center"><ScoreBadge score={student.avgQuiz} /></div>
            <div className="col-span-2 text-center"><ScoreBadge score={student.avgAssignment} /></div>
            <div className="col-span-2 text-center"><ScoreBadge score={student.overallScore} /></div>
            <div className="col-span-2 flex items-center justify-center gap-2">
              <span className="text-sm text-gray-600">
                {student.completedCount}/{student.lessonScores.length}
              </span>
              <span className="text-gray-300 text-xs ml-1">{expanded === student.userId ? "▲" : "▼"}</span>
            </div>
          </button>

          {/* Expanded lesson details */}
          {expanded === student.userId && (
            <div className="bg-gray-50 border-t px-5 py-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lesson breakdown</p>
              {student.lessonScores.map((ls, i) => {
                const assignPct = ls.assignmentScore !== null && ls.maxScore
                  ? Math.round((ls.assignmentScore / ls.maxScore) * 100)
                  : null;
                return (
                  <div key={ls.lessonId} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                    <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{ls.lessonTitle}</span>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-center w-20">
                        <p className="text-xs text-gray-400 mb-0.5">Quiz</p>
                        <ScoreBadge score={ls.quizScore} />
                      </div>
                      <div className="text-center w-24">
                        <p className="text-xs text-gray-400 mb-0.5">Assignment</p>
                        {ls.assignmentScore !== null ? (
                          <span className="text-xs">
                            <ScoreBadge score={assignPct} />
                            <span className="text-gray-400 ml-1">({ls.assignmentScore}/{ls.maxScore})</span>
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                      <div className="text-center w-20">
                        <p className="text-xs text-gray-400 mb-0.5">Done</p>
                        {ls.completed
                          ? <span className="text-green-500 text-sm">✓</span>
                          : <span className="text-gray-300 text-sm">○</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
