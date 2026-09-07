"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Subject {
  id: string;
  name_hy: string;
  name_en: string;
}

interface Test {
  id: string;
  subject_id: string;
  grade: number;
  test_type: string;
  year: string;
}

interface ScoredItem {
  number: number;
  max_points: number;
  awarded_points: number;
  extracted_answer: string;
  correct_answer: string;
  is_correct: boolean;
  confidence: number;
  explanation?: string;
}

export function ScanUploader({ subjects, tests }: { subjects: Subject[]; tests: Test[] }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [testId, setTestId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ items: ScoredItem[]; totalScore: number; resultId: string } | null>(null);

  const filteredTests = tests.filter((t) => t.subject_id === subjectId);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  const handleSubmit = async () => {
    if (!testId || !file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("test_id", testId);
      if (studentName.trim()) formData.append("student_name", studentName.trim());

      const res = await fetch("/api/ararka/score", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Scoring failed" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Select test */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">1. Select Test</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTestId("");
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            >
              <option value="">Select subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_hy} ({s.name_en})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade & Test</label>
            <select
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              disabled={!subjectId}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border disabled:bg-gray-100"
            >
              <option value="">Select test...</option>
              {filteredTests.map((t) => (
                <option key={t.id} value={t.id}>
                  Grade {t.grade} — {t.test_type} ({t.year})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student Name (optional)</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Armen Petrosyan"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
            />
          </div>
        </div>
      </div>

      {/* Step 2: Upload scan */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">2. Upload Scan</h2>
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mb-1 text-sm text-gray-500 font-medium">
                  {file ? file.name : "Click to upload or drag & drop"}
                </p>
                <p className="text-xs text-gray-400">JPG, PNG, or PDF (max 10MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
              />
            </label>
          </div>
          {preview && (
            <div className="w-48 h-48 rounded-lg overflow-hidden border bg-white flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Scan preview" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!testId || !file || loading}
          className="mt-4 inline-flex items-center px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Scoring...
            </>
          ) : (
            "Score Test"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Results</h2>
            <div className="text-2xl font-bold text-blue-600">
              {result.totalScore.toFixed(2)} / 15
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 px-3 font-medium text-gray-500">Q#</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Student Answer</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Correct Answer</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Points</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Confidence</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Note</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.number} className={`border-b ${item.is_correct ? "" : "bg-red-50"}`}>
                    <td className="py-2 px-3 font-medium">{item.number}</td>
                    <td className="py-2 px-3 max-w-[200px] truncate">{item.extracted_answer}</td>
                    <td className="py-2 px-3 max-w-[200px] truncate">{item.correct_answer}</td>
                    <td className="py-2 px-3">
                      <span className={item.awarded_points === item.max_points ? "text-green-600 font-medium" : item.awarded_points > 0 ? "text-yellow-600 font-medium" : "text-red-600 font-medium"}>
                        {item.awarded_points}
                      </span>
                      <span className="text-gray-400"> / {item.max_points}</span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.confidence >= 0.8 ? "bg-green-500" : item.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{ width: `${item.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{Math.round(item.confidence * 100)}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500 max-w-[200px] truncate">
                      {item.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => router.push(`/ararka/results/${result.resultId}`)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              View Full Details
            </button>
            <button
              onClick={() => {
                setResult(null);
                setFile(null);
                setPreview(null);
                setStudentName("");
              }}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              Score Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
