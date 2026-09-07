"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PDFDocument } from "pdf-lib";

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
  teacher_corrected?: boolean;
}

interface StudentResult {
  index: number;
  /** Where this student's test came from: a filename, or a page range. */
  source: string;
  status: "pending" | "scoring" | "scored" | "error";
  studentName: string | null;
  teacherName: string | null;
  totalScore: number | null;
  items: ScoredItem[] | null;
  resultId: string | null;
  scanId: string | null;
  error: string | null;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
}

interface TeacherInfo {
  id: string;
  full_name: string | null;
  email: string;
}

export function BatchUploader({
  subjects,
  tests,
  teachers,
}: {
  subjects: Subject[];
  tests: Test[];
  teachers?: TeacherInfo[];
}) {
  const [subjectId, setSubjectId] = useState("");
  const [testId, setTestId] = useState("");
  const [modelId, setModelId] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [pagesPerTest, setPagesPerTest] = useState(6);
  const [files, setFiles] = useState<File[]>([]);
  // Only meaningful when a single PDF holds several students' tests back to back.
  const [splitSingleFile, setSplitSingleFile] = useState(false);
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [splitting, setSplitting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [batchId] = useState(() => crypto.randomUUID());
  const [onBehalfOf, setOnBehalfOf] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [editedScores, setEditedScores] = useState<Record<number, number>>({});
  const [correctionReasons, setCorrectionReasons] = useState<Record<number, string>>({});
  const [savingCorrections, setSavingCorrections] = useState(false);
  const partsRef = useRef<{ blob: Blob; filename: string }[]>([]);
  const abortRef = useRef(false);

  useEffect(() => {
    fetch("/api/ararka/models")
      .then((r) => r.json())
      .then((data: { current: string; models: ModelInfo[] }) => {
        setModels(data.models ?? []);
        if (!modelId && data.current) setModelId(data.current);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTests = tests.filter((t) => t.subject_id === subjectId);

  // An LDM/admin is never the teacher of record — make them name one, or every
  // scan gets filed under the uploader's own id.
  const needsTeacher = !!teachers && teachers.length > 0;
  const readyToScore = !!testId && (!needsTeacher || !!onBehalfOf);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setFiles(picked);
    setStudents([]);
    partsRef.current = [];
    // Splitting only ever applies to a lone PDF; picking several always means
    // one file per student.
    if (picked.length > 1) setSplitSingleFile(false);
  }, []);

  const blankStudent = (index: number, source: string): StudentResult => ({
    index,
    source,
    status: "pending",
    studentName: null,
    teacherName: null,
    totalScore: null,
    items: null,
    resultId: null,
    scanId: null,
    error: null,
  });

  const handlePrepare = useCallback(async () => {
    if (files.length === 0) return;
    setSplitting(true);
    try {
      const parts: { blob: Blob; filename: string }[] = [];
      const studentList: StudentResult[] = [];

      if (files.length === 1 && splitSingleFile) {
        // One PDF holding several students' tests, cut every `pagesPerTest` pages.
        const arrayBuffer = await files[0].arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const totalPages = pdfDoc.getPageCount();
        const numStudents = Math.ceil(totalPages / pagesPerTest);

        for (let i = 0; i < numStudents; i++) {
          const startPage = i * pagesPerTest;
          const endPage = Math.min(startPage + pagesPerTest, totalPages);

          const chunkDoc = await PDFDocument.create();
          const pages = await chunkDoc.copyPages(
            pdfDoc,
            Array.from({ length: endPage - startPage }, (_, j) => startPage + j),
          );
          pages.forEach((p) => chunkDoc.addPage(p));
          const chunkBytes = await chunkDoc.save();

          parts.push({
            blob: new Blob([chunkBytes.buffer as ArrayBuffer], { type: "application/pdf" }),
            filename: `student_${i + 1}.pdf`,
          });
          studentList.push(blankStudent(i, `p. ${startPage + 1}-${endPage}`));
        }
      } else {
        // The normal case: each selected PDF is exactly one student.
        files.forEach((f, i) => {
          parts.push({ blob: f, filename: f.name });
          studentList.push(blankStudent(i, f.name));
        });
      }

      partsRef.current = parts;
      setStudents(studentList);
    } catch {
      setStudents([]);
    } finally {
      setSplitting(false);
    }
  }, [files, splitSingleFile, pagesPerTest]);

  const scoreStudent = useCallback(
    async (index: number): Promise<void> => {
      if (abortRef.current) return;
      const part = partsRef.current[index];
      if (!part) return;

      setStudents((prev) =>
        prev.map((s) => (s.index === index ? { ...s, status: "scoring" } : s)),
      );

      try {
        const formData = new FormData();
        formData.append("file", part.blob, part.filename);
        formData.append("test_id", testId);
        formData.append("batch_id", batchId);
        if (modelId) formData.append("model_id", modelId);
        if (onBehalfOf) formData.append("on_behalf_of", onBehalfOf);

        const res = await fetch("/api/ararka/score", { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Scoring failed" }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data = await res.json();
        setStudents((prev) =>
          prev.map((s) =>
            s.index === index
              ? {
                  ...s,
                  status: "scored",
                  studentName: data.studentName ?? `Student ${index + 1}`,
                  teacherName: data.teacherName,
                  totalScore: data.totalScore,
                  items: data.items,
                  resultId: data.resultId,
                  scanId: data.scanId,
                  error: null,
                }
              : s,
          ),
        );
      } catch (err) {
        setStudents((prev) =>
          prev.map((s) =>
            s.index === index
              ? { ...s, status: "error", error: err instanceof Error ? err.message : "Failed" }
              : s,
          ),
        );
      }
    },
    // modelId and onBehalfOf are read inside — without them here the callback
    // keeps a stale closure and silently posts the wrong model / teacher.
    [testId, batchId, modelId, onBehalfOf],
  );

  const handleScoreAll = useCallback(async () => {
    abortRef.current = false;
    setScoring(true);
    for (let i = 0; i < students.length; i++) {
      if (abortRef.current) break;
      if (students[i].status === "scored") continue;
      await scoreStudent(i);
    }
    setScoring(false);
  }, [students, scoreStudent]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleRetry = useCallback(
    async (index: number) => {
      await scoreStudent(index);
    },
    [scoreStudent],
  );

  const startEditing = useCallback(
    (resultId: string, items: ScoredItem[]) => {
      setEditingResult(resultId);
      const scores: Record<number, number> = {};
      items.forEach((item) => {
        scores[item.number] = item.awarded_points;
      });
      setEditedScores(scores);
      setCorrectionReasons({});
    },
    [],
  );

  const handleSaveCorrections = useCallback(async () => {
    if (!editingResult) return;
    const student = students.find((s) => s.resultId === editingResult);
    if (!student?.items) return;

    const corrections = student.items
      .filter((item) => editedScores[item.number] !== item.awarded_points)
      .map((item) => ({
        question_number: item.number,
        teacher_score: editedScores[item.number] ?? item.awarded_points,
        reason: correctionReasons[item.number] || undefined,
      }));

    if (corrections.length === 0) {
      setEditingResult(null);
      return;
    }

    setSavingCorrections(true);
    try {
      const res = await fetch("/api/ararka/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result_id: editingResult, corrections }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(body.error ?? "Failed to save corrections");
      }

      const data = await res.json();
      setStudents((prev) =>
        prev.map((s) =>
          s.resultId === editingResult
            ? { ...s, totalScore: data.teacherTotal, items: data.teacherItems }
            : s,
        ),
      );
      setEditingResult(null);
    } catch {
      // keep editing open on error
    } finally {
      setSavingCorrections(false);
    }
  }, [editingResult, students, editedScores, correctionReasons]);

  const scored = students.filter((s) => s.status === "scored");
  const avgScore = scored.length > 0 ? scored.reduce((s, st) => s + (st.totalScore ?? 0), 0) / scored.length : 0;

  return (
    <div className="space-y-6">
      {/* Step 1: Select test */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">1. Select Test</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <div className="mt-4 pt-4 border-t">
          <label className="block text-sm font-medium text-gray-700 mb-1">AI Scoring Model</label>
          {models.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <strong>No AI model is configured.</strong> Scoring will fail until an API key is
              set on the server — <code>ANTHROPIC_API_KEY</code> for the Claude models, or{" "}
              <code>GOOGLE_AI_API_KEY</code> for Gemini.
            </div>
          ) : (
            <>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {models.find((m) => m.id === modelId)?.description}
              </p>
            </>
          )}
        </div>
        {teachers && teachers.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teacher <span className="text-red-500">*</span>
            </label>
            <select
              value={onBehalfOf}
              onChange={(e) => setOnBehalfOf(e.target.value)}
              className={`w-full sm:w-96 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border ${
                onBehalfOf ? "border-gray-300" : "border-amber-400 bg-amber-50"
              }`}
            >
              <option value="">Select the teacher these tests belong to...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name ?? t.email} ({t.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {teachers.length} teachers. Results are filed under the teacher you pick, with you
              recorded as the uploader.
            </p>
          </div>
        )}
      </div>

      {/* Step 2: Upload PDF */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">2. Upload Scans (PDF)</h2>
        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="flex flex-col items-center justify-center py-4">
            <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500 font-medium">
              {files.length === 0
                ? "Select one PDF per student"
                : `${files.length} PDF${files.length === 1 ? "" : "s"} selected`}
            </p>
            <p className="text-xs text-gray-400">
              You can select many files at once — each one is scored as a separate student (max 25MB each)
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
          />
        </label>

        {files.length > 0 && (
          <ul className="mt-3 max-h-32 overflow-y-auto text-xs text-gray-600 space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex justify-between gap-3">
                <span className="truncate">{f.name}</span>
                <span className="text-gray-400 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        )}

        {files.length === 1 && (
          <div className="mt-4 pt-4 border-t">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={splitSingleFile}
                onChange={(e) => setSplitSingleFile(e.target.checked)}
                className="rounded border-gray-300"
              />
              This one PDF contains several students, split it by page count
            </label>
            {splitSingleFile && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-sm text-gray-700">Pages per student</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={pagesPerTest}
                  onChange={(e) => setPagesPerTest(parseInt(e.target.value) || 6)}
                  className="w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
                />
              </div>
            )}
          </div>
        )}

        {files.length > 0 && students.length === 0 && (
          <div className="mt-4">
            <button
              onClick={() => void handlePrepare()}
              disabled={splitting || !readyToScore}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {splitting ? "Preparing..." : "Continue"}
            </button>
            {!testId && (
              <p className="text-xs text-amber-600 mt-2">Select a subject and test above first.</p>
            )}
            {testId && needsTeacher && !onBehalfOf && (
              <p className="text-xs text-amber-600 mt-2">
                Select the teacher these tests belong to above first.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Student list + scoring */}
      {students.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              3. Students ({students.length} detected)
            </h2>
            <div className="flex items-center gap-3">
              {scored.length > 0 && (
                <span className="text-sm text-gray-500">
                  Avg: <strong className="text-gray-900">{avgScore.toFixed(1)}</strong>/15
                  {" | "}Scored: {scored.length}/{students.length}
                </span>
              )}
              {scoring ? (
                <button
                  onClick={handleStop}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors text-sm"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleScoreAll}
                  disabled={!readyToScore || students.every((s) => s.status === "scored")}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {scored.length > 0 && scored.length < students.length
                    ? "Continue Scoring"
                    : `Score All (${students.length})`}
                </button>
              )}
            </div>
          </div>

          {!scoring && students.every((s) => s.status === "pending") && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              {students.length} student{students.length === 1 ? "" : "s"} ready. Nothing is scored
              yet — click <strong>Score All</strong> to start.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="py-2 px-3 font-medium text-gray-500 w-8">#</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Student</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Source</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Score</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Status</th>
                  <th className="py-2 px-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const pct = student.totalScore !== null ? (student.totalScore / 15) * 100 : 0;
                  const isExpanded = expandedStudent === student.index;

                  return (
                    <tr key={student.index} className="border-b group">
                      <td className="py-2 px-3 text-gray-500">{student.index + 1}</td>
                      <td className="py-2 px-3 font-medium">
                        {student.studentName ?? (
                          <span className="text-gray-400 italic">
                            {student.status === "pending" ? "Pending..." : "Extracting..."}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-500 max-w-[180px] truncate" title={student.source}>
                        {student.source}
                      </td>
                      <td className="py-2 px-3">
                        {student.totalScore !== null ? (
                          <>
                            <span className={`font-medium ${pct >= 70 ? "text-green-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                              {student.totalScore.toFixed(1)}
                            </span>
                            <span className="text-gray-400"> / 15</span>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {student.status === "scoring" && (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Scoring...
                          </span>
                        )}
                        {student.status === "scored" && (
                          <span className="text-green-600 text-xs font-medium">Scored</span>
                        )}
                        {student.status === "error" && (
                          <span
                            className="text-red-600 text-xs block max-w-[220px]"
                            title={student.error ?? undefined}
                          >
                            {student.error ?? "Error"}
                          </span>
                        )}
                        {student.status === "pending" && (
                          <span className="text-gray-400 text-xs">Pending</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {student.status === "scored" && student.items && (
                            <button
                              onClick={() => setExpandedStudent(isExpanded ? null : student.index)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              {isExpanded ? "Collapse" : "Details"}
                            </button>
                          )}
                          {student.status === "error" && (
                            <button
                              onClick={() => void handleRetry(student.index)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded detail for a student */}
          {expandedStudent !== null && (() => {
            const student = students.find((s) => s.index === expandedStudent);
            if (!student?.items) return null;
            const isEditing = editingResult === student.resultId;

            return (
              <div className="mt-4 border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {student.studentName ?? `Student ${student.index + 1}`} — Question Breakdown
                  </h3>
                  <div className="flex items-center gap-2">
                    {!isEditing && student.resultId && (
                      <button
                        onClick={() => startEditing(student.resultId!, student.items!)}
                        className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium hover:bg-yellow-200 transition-colors"
                      >
                        Correct Scores
                      </button>
                    )}
                    {isEditing && (
                      <>
                        <button
                          onClick={() => setEditingResult(null)}
                          className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void handleSaveCorrections()}
                          disabled={savingCorrections}
                          className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingCorrections ? "Saving..." : "Save Corrections"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1.5 px-2 font-medium text-gray-500">Q#</th>
                      <th className="py-1.5 px-2 font-medium text-gray-500">Student Answer</th>
                      <th className="py-1.5 px-2 font-medium text-gray-500">Correct</th>
                      <th className="py-1.5 px-2 font-medium text-gray-500">
                        {isEditing ? "AI / Your Score" : "Score"}
                      </th>
                      <th className="py-1.5 px-2 font-medium text-gray-500">Confidence</th>
                      {isEditing && <th className="py-1.5 px-2 font-medium text-gray-500">Reason</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {student.items.map((item) => {
                      const changed = isEditing && editedScores[item.number] !== item.awarded_points;
                      return (
                        <tr
                          key={item.number}
                          className={`border-b ${item.teacher_corrected ? "bg-yellow-50" : item.is_correct ? "" : "bg-red-50"} ${changed ? "bg-blue-50" : ""}`}
                        >
                          <td className="py-1.5 px-2 font-medium">{item.number}</td>
                          <td className="py-1.5 px-2 max-w-[150px] truncate text-xs">{item.extracted_answer}</td>
                          <td className="py-1.5 px-2 max-w-[150px] truncate text-xs">{item.correct_answer}</td>
                          <td className="py-1.5 px-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-400 text-xs">{item.awarded_points}</span>
                                <span className="text-gray-300">/</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.max_points}
                                  step={0.25}
                                  value={editedScores[item.number] ?? item.awarded_points}
                                  onChange={(e) =>
                                    setEditedScores((prev) => ({
                                      ...prev,
                                      [item.number]: parseFloat(e.target.value) || 0,
                                    }))
                                  }
                                  className={`w-14 px-1 py-0.5 border rounded text-xs text-center ${changed ? "border-blue-400 bg-blue-50" : "border-gray-300"}`}
                                />
                                <span className="text-gray-400 text-xs">/ {item.max_points}</span>
                              </div>
                            ) : (
                              <>
                                <span className={`font-medium ${item.awarded_points === item.max_points ? "text-green-600" : item.awarded_points > 0 ? "text-yellow-600" : "text-red-600"}`}>
                                  {item.awarded_points}
                                </span>
                                <span className="text-gray-400"> / {item.max_points}</span>
                                {item.teacher_corrected && (
                                  <span className="ml-1 text-xs text-yellow-600" title="Teacher corrected">*</span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            <span className={`text-xs ${item.confidence >= 0.8 ? "text-green-600" : item.confidence >= 0.5 ? "text-yellow-600" : "text-red-600"}`}>
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </td>
                          {isEditing && (
                            <td className="py-1.5 px-2">
                              {changed && (
                                <input
                                  type="text"
                                  placeholder="Why?"
                                  value={correctionReasons[item.number] ?? ""}
                                  onChange={(e) =>
                                    setCorrectionReasons((prev) => ({
                                      ...prev,
                                      [item.number]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                                />
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
