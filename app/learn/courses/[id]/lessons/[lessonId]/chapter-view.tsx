"use client";
import { useState } from "react";

type Question = { question: string; options: string[]; correct: number };
type Chapter = { id: string; title: string; start: number; end: number; questions: Question[] };

function chapterEmbedUrl(videoUrl: string, start: number, end: number): string {
  try {
    const u = new URL(videoUrl);
    // YouTube
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId = u.searchParams.get("v");
      if (!videoId) videoId = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${videoId}?start=${start}&end=${end}`;
    }
    // Google Drive
    const driveMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview#t=${start}`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video${u.pathname}#t=${start}s`;
    }
    return videoUrl;
  } catch {
    return videoUrl;
  }
}

function InlineQuiz({ questions, chapterIndex }: { questions: Question[]; chapterIndex: number }) {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  if (questions.length === 0) return null;

  const allAnswered = answers.every((a) => a !== null);

  function submit() {
    const correct = questions.filter((q, i) => answers[i] === q.correct).length;
    setScore(Math.round((correct / questions.length) * 100));
    setSubmitted(true);
  }

  function retake() {
    setAnswers(Array(questions.length).fill(null));
    setSubmitted(false);
    setScore(null);
  }

  return (
    <div className="mt-4 border rounded-xl overflow-hidden">
      <div className="bg-brand-50 border-b border-brand-100 px-4 py-3">
        <p className="text-sm font-semibold text-brand-900">📝 Chapter {chapterIndex + 1} Quiz</p>
        <p className="text-xs text-brand-700 mt-0.5">{questions.length} questions — check your understanding before moving on</p>
      </div>

      {submitted && score !== null ? (
        <div className="p-5">
          <div className={`text-center mb-4`}>
            <p className={`text-4xl font-bold ${score >= 70 ? "text-green-600" : "text-orange-500"}`}>{score}%</p>
            <p className="text-sm text-gray-500 mt-1">{score >= 70 ? "Great job!" : "Review the chapter and try again."}</p>
          </div>
          <div className="space-y-2 mb-4">
            {questions.map((q, i) => {
              const isRight = answers[i] === q.correct;
              return (
                <div key={i} className={`p-3 rounded-lg text-sm ${isRight ? "bg-green-50" : "bg-red-50"}`}>
                  <p className="font-medium mb-1">{q.question}</p>
                  <p className={isRight ? "text-green-700" : "text-red-700"}>
                    {isRight ? "✓" : "✗"} {answers[i] !== null ? q.options[answers[i]!] : "—"}
                  </p>
                  {!isRight && <p className="text-green-700">✓ {q.options[q.correct]}</p>}
                </div>
              );
            })}
          </div>
          <button onClick={retake} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50">Retake</button>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {questions.map((q, qi) => (
            <div key={qi}>
              <p className="text-sm font-medium mb-2">{qi + 1}. {q.question}</p>
              <div className="space-y-1.5">
                {q.options.map((opt, oi) => (
                  <label key={oi} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition text-sm ${
                    answers[qi] === oi ? "border-brand-500 bg-brand-50" : "border-transparent hover:bg-gray-50"
                  }`}>
                    <input type="radio" name={`ch-quiz-${chapterIndex}-q${qi}`} checked={answers[qi] === oi}
                      onChange={() => { const a = [...answers]; a[qi] = oi; setAnswers(a); }} className="shrink-0" />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={submit} disabled={!allAnswered}
            className="w-full bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium">
            Submit
          </button>
        </div>
      )}
    </div>
  );
}

export function ChapterView({ chapters, videoUrl }: { chapters: Chapter[]; videoUrl: string }) {
  return (
    <div className="space-y-6 mb-6">
      {chapters.map((ch, i) => (
        <div key={ch.id} className="border rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold text-sm">{ch.title || `Chapter ${i + 1}`}</p>
              <p className="text-xs text-gray-400">
                {Math.floor(ch.start / 60)}:{String(ch.start % 60).padStart(2, "0")} – {Math.floor(ch.end / 60)}:{String(ch.end % 60).padStart(2, "0")}
              </p>
            </div>
          </div>
          <div className="aspect-video bg-black">
            <iframe
              src={chapterEmbedUrl(videoUrl, ch.start, ch.end)}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
          {ch.questions.length > 0 && (
            <div className="p-4">
              <InlineQuiz questions={ch.questions} chapterIndex={i} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
