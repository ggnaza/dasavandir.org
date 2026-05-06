"use client";
import { useState, useRef, useEffect } from "react";

type Question = { question: string; options: string[]; correct: number };
type Chapter = { id: string; title: string; start: number; end: number; questions: Question[] };

// ─── Shared quiz component ────────────────────────────────────────────────────

function InlineQuiz({
  questions,
  chapterIndex,
  onContinue,
}: {
  questions: Question[];
  chapterIndex: number;
  onContinue?: () => void;
}) {
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
          <div className="text-center mb-4">
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
          <div className="flex gap-2">
            <button onClick={retake} className="text-sm border rounded-lg px-4 py-2 hover:bg-gray-50">Retake</button>
            {onContinue && (
              <button onClick={onContinue} className="text-sm bg-brand-600 text-white rounded-lg px-4 py-2 hover:bg-brand-700 font-medium">
                Continue →
              </button>
            )}
          </div>
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

// ─── Native video player with chapter seek (self-hosted) ─────────────────────

function NativeVideoChapters({ chapters, videoUrl }: { chapters: Chapter[]; videoUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [quizChapter, setQuizChapter] = useState<number | null>(null);
  const shownQuizzes = useRef<Set<number>>(new Set());

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onTimeUpdate() {
      const t = video.currentTime;
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (t >= chapters[i].start) {
          setActiveChapter(i);
          const ch = chapters[i];
          if (ch.questions.length > 0 && t >= ch.end - 0.5 && !shownQuizzes.current.has(i)) {
            video.pause();
            shownQuizzes.current.add(i);
            setQuizChapter(i);
          }
          break;
        }
      }
    }

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [chapters]);

  function seekToChapter(index: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = chapters[index].start;
    video.play();
    setActiveChapter(index);
    setQuizChapter(null);
  }

  function continueAfterQuiz() {
    setQuizChapter(null);
    const next = activeChapter + 1;
    if (next < chapters.length) seekToChapter(next);
    else videoRef.current?.play();
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <video ref={videoRef} src={videoUrl} controls className="w-full h-full" controlsList="nodownload" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {chapters.map((ch, i) => (
          <button
            key={ch.id}
            onClick={() => seekToChapter(i)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition ${
              activeChapter === i
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
            }`}
          >
            <span className="font-medium">{i + 1}.</span> {ch.title || `Chapter ${i + 1}`}
            <span className="ml-1.5 text-xs opacity-60">
              {Math.floor(ch.start / 60)}:{String(ch.start % 60).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>

      {quizChapter !== null && chapters[quizChapter]?.questions.length > 0 && (
        <InlineQuiz questions={chapters[quizChapter].questions} chapterIndex={quizChapter} onContinue={continueAfterQuiz} />
      )}
    </div>
  );
}

// ─── Iframe-based chapters (YouTube / Google Drive) ──────────────────────────

function chapterEmbedUrl(videoUrl: string, start: number, end: number): string {
  try {
    const u = new URL(videoUrl);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId = u.searchParams.get("v");
      if (!videoId) videoId = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${videoId}?start=${start}&end=${end}`;
    }
    const driveMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview#t=${start}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video${u.pathname}#t=${start}s`;
    return videoUrl;
  } catch {
    return videoUrl;
  }
}

function IframeChapters({ chapters, videoUrl }: { chapters: Chapter[]; videoUrl: string }) {
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
                {Math.floor(ch.start / 60)}:{String(ch.start % 60).padStart(2, "0")} –{" "}
                {Math.floor(ch.end / 60)}:{String(ch.end % 60).padStart(2, "0")}
              </p>
            </div>
          </div>
          <div className="aspect-video bg-black">
            <iframe src={chapterEmbedUrl(videoUrl, ch.start, ch.end)} className="w-full h-full" allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
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

// ─── Public export ────────────────────────────────────────────────────────────

export function ChapterView({
  chapters,
  videoUrl,
  isStorageVideo,
}: {
  chapters: Chapter[];
  videoUrl: string;
  isStorageVideo?: boolean;
}) {
  if (isStorageVideo) return <NativeVideoChapters chapters={chapters} videoUrl={videoUrl} />;
  return <IframeChapters chapters={chapters} videoUrl={videoUrl} />;
}
