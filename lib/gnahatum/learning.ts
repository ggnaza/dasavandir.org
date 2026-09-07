import { gnahatumDb } from "./db";
import type { AnswerKeyItem, ScoredItem } from "./constants";

/**
 * The model-independent knowledge layer.
 *
 * Everything here is keyed on (test_id, question_number) and stored as plain
 * text — never on a model id. That is deliberate: the accumulated knowledge is
 * injected into the scoring prompt, so whichever model is scoring today reads
 * the same corpus. Switching Claude to Gemini, or Sonnet to Opus, loses none
 * of it. Per-model accuracy lives in `ararka.benchmark_runs` instead.
 */

export interface AnswerVariant {
  question_number: number;
  variant_text: string;
  verdict: "accept" | "reject" | "partial";
  points_awarded: number | null;
  times_seen: number;
}

export interface ScoringPrecedent {
  question_number: number;
  rule_text: string;
  evidence_count: number;
}

export interface LearnedKnowledge {
  variants: AnswerVariant[];
  precedents: ScoringPrecedent[];
}

export const EMPTY_KNOWLEDGE: LearnedKnowledge = { variants: [], precedents: [] };

/**
 * How many variants of each verdict to show per question. The prompt has to
 * stay bounded — a popular test could accumulate hundreds of variants, and
 * pasting all of them would crowd out the scan itself.
 */
const MAX_VARIANTS_PER_QUESTION = 6;

export function normalizeVariant(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Load what has been learned about one test. Never throws: scoring must still
 * work when the learning tables are missing or unreachable, so a failure here
 * degrades to "no learned knowledge" rather than failing the scan.
 */
export async function fetchLearnedKnowledge(testId: string): Promise<LearnedKnowledge> {
  const db = gnahatumDb();

  try {
    const [variantsRes, precedentsRes] = await Promise.all([
      db
        .from("answer_variants")
        .select("question_number, variant_text, verdict, points_awarded, times_seen")
        .eq("test_id", testId)
        .eq("status", "active")
        .order("times_seen", { ascending: false })
        .limit(400),
      db
        .from("scoring_precedents")
        .select("question_number, rule_text, evidence_count")
        .eq("test_id", testId)
        .eq("status", "active")
        .order("evidence_count", { ascending: false })
        .limit(100),
    ]);

    return {
      variants: (variantsRes.data ?? []) as AnswerVariant[],
      precedents: (precedentsRes.data ?? []) as ScoringPrecedent[],
    };
  } catch {
    return EMPTY_KNOWLEDGE;
  }
}

/**
 * Render the learned knowledge as a prompt section.
 *
 * Plain text on purpose — this is what makes the layer portable. Any model
 * that can read the answer key can read this.
 */
export function formatLearnedKnowledge(
  knowledge: LearnedKnowledge,
  answerKey: AnswerKeyItem[],
): string {
  const byQuestion = new Map<number, { accepted: string[]; rejected: string[]; rules: string[] }>();

  const bucket = (n: number) => {
    let entry = byQuestion.get(n);
    if (!entry) {
      entry = { accepted: [], rejected: [], rules: [] };
      byQuestion.set(n, entry);
    }
    return entry;
  };

  // Hand-authored variants from the official answer key come first — they are
  // the published position, not an inference from grading behaviour.
  for (const item of answerKey) {
    for (const variant of item.accepted_variants ?? []) {
      bucket(item.number).accepted.push(variant);
    }
  }

  for (const v of knowledge.variants) {
    const entry = bucket(v.question_number);
    const seen = v.times_seen > 1 ? ` (seen ${v.times_seen}x)` : "";
    if (v.verdict === "accept") {
      if (entry.accepted.length < MAX_VARIANTS_PER_QUESTION) {
        entry.accepted.push(`${v.variant_text}${seen}`);
      }
    } else if (v.verdict === "reject") {
      if (entry.rejected.length < MAX_VARIANTS_PER_QUESTION) {
        entry.rejected.push(`${v.variant_text}${seen}`);
      }
    } else if (entry.accepted.length < MAX_VARIANTS_PER_QUESTION) {
      const pts = v.points_awarded !== null ? ` → ${v.points_awarded} pts` : "";
      entry.accepted.push(`${v.variant_text}${pts} (partial credit)${seen}`);
    }
  }

  for (const p of knowledge.precedents) {
    bucket(p.question_number).rules.push(p.rule_text);
  }

  const sections: string[] = [];
  // Array.from rather than spreading the iterator: this project targets a
  // pre-ES2015 lib where spreading a MapIterator does not compile.
  for (const n of Array.from(byQuestion.keys()).sort((a, b) => a - b)) {
    const entry = byQuestion.get(n)!;
    if (!entry.accepted.length && !entry.rejected.length && !entry.rules.length) continue;

    const lines = [`Q${n}:`];
    if (entry.accepted.length) {
      lines.push(`  Previously ACCEPTED by a teacher: ${entry.accepted.join(" | ")}`);
    }
    if (entry.rejected.length) {
      lines.push(`  Previously REJECTED by a teacher: ${entry.rejected.join(" | ")}`);
    }
    for (const rule of entry.rules) {
      lines.push(`  Scoring precedent: ${rule}`);
    }
    sections.push(lines.join("\n"));
  }

  if (!sections.length) return "";

  return `LEARNED FROM PREVIOUS HUMAN GRADING OF THIS EXACT TEST:
These are real student answers that teachers have already ruled on. Treat them
as authoritative for this test — if a student writes something equivalent to an
accepted variant, award the points even if the wording differs from the answer
key.

${sections.join("\n")}
`;
}

/**
 * Turn one teacher correction into durable knowledge.
 *
 * A correction says "the AI gave X, the human gave Y" for a question whose
 * scanned answer we already extracted. That triple is the evidence: the
 * student's own words, plus a human verdict on them.
 */
export async function recordCorrectionAsKnowledge(params: {
  testId: string;
  correctedBy: string;
  corrections: Array<{ question_number: number; teacher_score: number }>;
  items: Array<{ number: number; max_points: number; extracted_answer?: string }>;
}): Promise<number> {
  const db = gnahatumDb();
  let recorded = 0;

  for (const correction of params.corrections) {
    const item = params.items.find((i) => i.number === correction.question_number);
    const studentAnswer = item?.extracted_answer?.trim();

    // Nothing to learn without the student's actual words. A blank or
    // unreadable answer tells us about the scan, not about the question.
    if (!studentAnswer) continue;

    const maxPoints = item?.max_points ?? 0;
    const verdict =
      correction.teacher_score >= maxPoints && maxPoints > 0
        ? "accept"
        : correction.teacher_score <= 0
          ? "reject"
          : "partial";

    try {
      await db.rpc("record_answer_variant", {
        p_test_id: params.testId,
        p_question_number: correction.question_number,
        p_variant_text: studentAnswer,
        p_verdict: verdict,
        p_points_awarded: correction.teacher_score,
        p_max_points: maxPoints,
        p_source: "teacher_correction",
        p_created_by: params.correctedBy,
      });
      recorded += 1;
    } catch {
      // Learning is a side benefit of correcting — never fail the correction
      // itself because the knowledge write did not land.
    }
  }

  return recorded;
}

/**
 * Same idea, but for a gold-set scan whose true per-question scores a human
 * typed in. Every question the model got wrong becomes evidence.
 */
export async function recordGoldComparisonAsKnowledge(params: {
  testId: string;
  gradedBy: string | null;
  aiItems: ScoredItem[];
  humanPoints: Map<number, number>;
}): Promise<number> {
  const db = gnahatumDb();
  let recorded = 0;

  for (const aiItem of params.aiItems) {
    const humanScore = params.humanPoints.get(aiItem.number);
    if (humanScore === undefined) continue;

    // Only disagreements are informative. Where the model already agrees with
    // the human there is nothing to teach it.
    if (Math.abs(humanScore - aiItem.awarded_points) < 0.01) continue;

    const studentAnswer = aiItem.extracted_answer?.trim();
    if (!studentAnswer) continue;

    const verdict =
      humanScore >= aiItem.max_points && aiItem.max_points > 0
        ? "accept"
        : humanScore <= 0
          ? "reject"
          : "partial";

    try {
      await db.rpc("record_answer_variant", {
        p_test_id: params.testId,
        p_question_number: aiItem.number,
        p_variant_text: studentAnswer,
        p_verdict: verdict,
        p_points_awarded: humanScore,
        p_max_points: aiItem.max_points,
        p_source: "gold_set",
        p_created_by: params.gradedBy,
      });
      recorded += 1;
    } catch {
      // As above — never fail the benchmark because a write did not land.
    }
  }

  return recorded;
}
