"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RichText } from "./rich-text";
import { AnswerInput, type AnswerValue } from "./answer-input";
import { isAnswered, type AnswerType, type Choice } from "@/lib/attestation-core";

interface Question {
  id: string;
  number: string;
  answer_type: AnswerType;
  prompt: string;
  options: Choice[];
  match_slots: Choice[];
  image_path: string | null;
  passage_id: string | null;
}
interface Passage {
  id: string;
  label: string | null;
  body: string;
  image_path: string | null;
}
interface TakePayload {
  state: "in_progress" | "done";
  attemptId?: string;
  answers?: Record<string, AnswerValue>;
  deadline?: string | null;
  test?: { title: string; subject: string; description: string | null };
  passages?: Passage[];
  questions?: Question[];
  figures?: Record<string, string>;
}

type Phase = "loading" | "error" | "taking" | "submitted" | "done";

/** The teacher's test screen: one question per screen, autosave, timer, submit. Never shows a score. */
export function TestRunner({ testId }: { testId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TakePayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<Record<string, AnswerValue>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/attestation/take/${testId}`, { method: "POST" });
      const body = (await res.json()) as TakePayload & { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError(body.error ?? "Սխալ");
        setPhase("error");
        return;
      }
      if (body.state === "done") {
        setPhase("done");
        return;
      }
      setData(body);
      setAnswers(body.answers ?? {});
      setPhase("taking");
    }
    load().catch(() => {
      if (!cancelled) {
        setError("Չհաջողվեց բեռնել թեստը");
        setPhase("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const flush = useCallback(async () => {
    if (!data?.attemptId) return;
    const batch = pending.current;
    if (Object.keys(batch).length === 0) return;
    pending.current = {};
    setSaveState("saving");
    try {
      const res = await fetch(`/api/attestation/attempts/${data.attemptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: batch }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaveState("saved");
    } catch {
      // Put the batch back so the next change (or submit) retries it.
      pending.current = { ...batch, ...pending.current };
      setSaveState("error");
    }
  }, [data?.attemptId]);

  const change = (qid: string, v: AnswerValue) => {
    setAnswers((a) => ({ ...a, [qid]: v }));
    pending.current[qid] = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };

  const submit = useCallback(async () => {
    if (!data?.attemptId) return;
    if (timer.current) clearTimeout(timer.current);
    await flush();
    const res = await fetch(`/api/attestation/attempts/${data.attemptId}/submit`, { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Չհաջողվեց հանձնել");
      return;
    }
    setPhase("submitted");
  }, [data?.attemptId, flush]);

  // Countdown; at zero the attempt is submitted as it stands.
  const deadline = data?.deadline ? new Date(data.deadline).getTime() : null;
  useEffect(() => {
    if (!deadline || phase !== "taking") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline, phase]);
  useEffect(() => {
    if (deadline && phase === "taking" && now >= deadline) void submit();
  }, [deadline, now, phase, submit]);

  const questions = data?.questions ?? [];
  const passages = useMemo(() => new Map((data?.passages ?? []).map((p) => [p.id, p])), [data?.passages]);
  const answeredCount = questions.filter((q) => isAnswered(q.answer_type, answers[q.id] ?? null)).length;

  if (phase === "loading") return <p className="text-gray-500">Բեռնվում է…</p>;
  if (phase === "error") return <p className="text-red-600">{error}</p>;
  if (phase === "done" || phase === "submitted") {
    return (
      <div className="max-w-lg mx-auto text-center bg-white rounded-xl border p-8 space-y-3">
        <p className="text-2xl">✓</p>
        <h1 className="text-lg font-semibold">Թեստը հանձնված է</h1>
        <p className="text-gray-600 text-sm">Շնորհակալություն։ Ձեր պատասխանները պահպանված են։</p>
        <Link href="/attestation" className="inline-block text-violet-700 underline text-sm">
          Վերադառնալ թեստերի ցանկին
        </Link>
      </div>
    );
  }

  const q = questions[index];
  if (!q) return <p className="text-gray-500">Այս թեստում հարցեր չկան։</p>;
  const passage = q.passage_id ? passages.get(q.passage_id) : undefined;
  const figures = data?.figures ?? {};
  const remaining = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">{data?.test?.subject}</p>
          <h1 className="text-lg font-semibold">{data?.test?.title}</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            {answeredCount}/{questions.length} պատասխանված
          </span>
          {remaining !== null && (
            <span className={remaining < 300 ? "text-red-600 font-semibold" : ""}>
              ⏱ {Math.floor(remaining / 3600)}:{String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}:
              {String(remaining % 60).padStart(2, "0")}
            </span>
          )}
          <span className={saveState === "error" ? "text-red-600" : "text-gray-400"}>
            {saveState === "saving" ? "Պահպանվում է…" : saveState === "error" ? "Չպահպանվեց" : "Պահպանված է"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1" aria-label="Հարցեր">
        {questions.map((qq, i) => {
          const done = isAnswered(qq.answer_type, answers[qq.id] ?? null);
          return (
            <button
              key={qq.id}
              type="button"
              title={`Հարց ${qq.number}`}
              onClick={() => setIndex(i)}
              className={`min-w-[2rem] h-8 px-1 rounded text-xs border ${
                i === index ? "border-violet-600 ring-2 ring-violet-300" : "border-gray-200"
              } ${done ? "bg-violet-600 text-white" : "bg-white text-gray-700"}`}
            >
              {qq.number}
            </button>
          );
        })}
      </div>

      <div className={`grid gap-4 ${passage ? "lg:grid-cols-2" : ""}`}>
        {passage && (
          <aside className="bg-white rounded-xl border p-4 lg:sticky lg:top-4 lg:max-h-[80vh] lg:overflow-y-auto">
            {passage.label && <p className="text-xs text-gray-500 mb-2">{passage.label}</p>}
            <RichText text={passage.body} />
            {passage.image_path && figures[passage.image_path] && (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
              <img src={figures[passage.image_path]} alt="" className="mt-3 max-w-full rounded border" />
            )}
          </aside>
        )}
        <section className="bg-white rounded-xl border p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Հարց {q.number} · {index + 1}/{questions.length}
          </p>
          <RichText text={q.prompt} />
          {q.image_path && figures[q.image_path] && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
            <img src={figures[q.image_path]} alt="" className="max-w-full rounded border" />
          )}
          <AnswerInput
            type={q.answer_type}
            options={q.options}
            slots={q.match_slots}
            value={answers[q.id] ?? null}
            onChange={(v) => change(q.id, v)}
          />
        </section>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="px-4 py-2 rounded-lg border disabled:opacity-40"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          ← Նախորդ
        </button>
        {index < questions.length - 1 ? (
          <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setIndex((i) => i + 1)}>
            Հաջորդ →
          </button>
        ) : (
          <button type="button" className="px-4 py-2 rounded-lg bg-violet-600 text-white" onClick={() => setConfirming(true)}>
            Ավարտել թեստը
          </button>
        )}
      </div>

      {confirming && (
        <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 space-y-3">
          <p className="text-sm">
            {answeredCount < questions.length
              ? `Պատասխանված չէ ${questions.length - answeredCount} հարց։ `
              : ""}
            Հանձնելուց հետո պատասխանները փոխել հնարավոր չի լինի։
          </p>
          <div className="flex gap-2">
            <button type="button" className="px-4 py-2 rounded-lg bg-violet-600 text-white" onClick={() => void submit()}>
              Հանձնել
            </button>
            <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setConfirming(false)}>
              Չեղարկել
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
