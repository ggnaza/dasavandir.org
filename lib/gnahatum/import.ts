import { POINT_DISTRIBUTION, TOTAL_QUESTIONS, type AnswerKeyItem } from "./constants";

/**
 * Turning an official test document into an answer key.
 *
 * Every Gnahatum test document ends with a `Հավելված 1. Թեստի բանալի` section
 * holding the correct answers, and a `Հավելված 2` table giving the point split.
 * This module pulls the key out of that text and validates it hard, because a
 * wrong answer key silently mis-grades real students — a bad import must fail
 * loudly here rather than reach `ararka.tests`.
 */

export const QUESTION_TYPES = [
  "multiple_choice", "fill_blank", "matching", "short_answer",
  "computation", "essay", "table", "diagram", "true_false",
] as const;

export interface ImportedKey {
  items: AnswerKeyItem[];
  /** Anything the extractor could not resolve — shown to the reviewer. */
  warnings: string[];
  /** What the model inferred from the document header, as a starting point. */
  suggested: { subject_hint: string | null; grade: number | null; test_type: string | null; year: string | null };
}

export const EXTRACTION_SYSTEM_PROMPT = `You extract answer keys from Armenian standardised school test documents.

Every document has 15 questions and ends with a section titled "Հավելված 1" / "Թեստի բանալի" (the answer key), followed by "Հավելված 2" with the point distribution.

Return ONLY a JSON object of this exact shape:

{
  "suggested": {
    "subject_hint": "the subject as printed, e.g. Քիմիա",
    "grade": 8,
    "test_type": "diagnostic",
    "year": "2025"
  },
  "warnings": ["short notes about anything ambiguous"],
  "items": [
    {
      "number": 1,
      "type": "multiple_choice",
      "answer": "the correct answer, transcribed from Հավելված 1",
      "accepted_variants": ["other phrasings the key explicitly allows"],
      "scoring_notes": "sub-point split, e.g. 2 x 0,5 միավոր"
    }
  ]
}

Rules that matter:
- Exactly 15 items, numbered 1 to 15. If the key is missing an answer, still emit the item with an empty "answer" and add a warning naming the question.
- Do NOT invent answers. Transcribe what Հավելված 1 actually says. An empty answer with a warning is correct; a plausible guess is not.
- "type" must be one of: ${QUESTION_TYPES.join(", ")}.
- Where the key lists alternatives ("Հնարավոր պատասխաններ", "Ակնկալվող պատասխաններ"), put the primary one in "answer" and the rest in "accepted_variants".
- If a question depends on a figure the text cannot convey, transcribe what the key says and add a warning that it is figure-dependent.
- If the key's numbering is offset or duplicated relative to the question body, realign to the question body and add a warning explaining what you changed.
- If the key contradicts itself (e.g. states an answer its own working disproves), use the defensible value and add a warning.
- "test_type" is "diagnostic" for a Հայտորոշիչ paper and "summative" for an Ամփոփիչ one.
- Do not include the points — they are fixed by question number and applied by the system.`;

/** Strip a JSON object out of a model response that may carry prose or fences. */
export function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The model did not return a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

interface RawItem {
  number?: unknown;
  type?: unknown;
  answer?: unknown;
  accepted_variants?: unknown;
  scoring_notes?: unknown;
}

/**
 * Normalise and validate an extraction into something safe to store.
 *
 * Points are never taken from the model — they are assigned from the fixed
 * distribution by question number, which is what the scorer clamps to anyway.
 */
export function normaliseImportedKey(raw: unknown): ImportedKey {
  if (!raw || typeof raw !== "object") throw new Error("The model returned no usable object");

  const obj = raw as { items?: unknown; warnings?: unknown; suggested?: unknown };
  if (!Array.isArray(obj.items)) throw new Error("The model returned no items array");

  const warnings: string[] = Array.isArray(obj.warnings)
    ? obj.warnings.filter((w): w is string => typeof w === "string")
    : [];

  const byNumber = new Map<number, RawItem>();
  for (const entry of obj.items as RawItem[]) {
    const n = Number(entry?.number);
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_QUESTIONS) continue;
    // First occurrence wins; a duplicate is a model error, not new information.
    if (!byNumber.has(n)) byNumber.set(n, entry);
    else warnings.push(`Q${n}: the extraction contained more than one answer; kept the first.`);
  }

  const items: AnswerKeyItem[] = [];
  for (let n = 1; n <= TOTAL_QUESTIONS; n += 1) {
    const entry = byNumber.get(n);
    const answer = typeof entry?.answer === "string" ? entry.answer.trim() : "";
    if (!answer) warnings.push(`Q${n}: no answer found in the document — fill this in before saving.`);

    const type = typeof entry?.type === "string" && (QUESTION_TYPES as readonly string[]).includes(entry.type)
      ? (entry.type as AnswerKeyItem["type"])
      : "short_answer";

    const variants = Array.isArray(entry?.accepted_variants)
      ? (entry.accepted_variants as unknown[])
          .filter((v): v is string => typeof v === "string" && v.trim() !== "")
          .map((v) => v.trim())
      : [];

    items.push({
      number: n,
      // Never from the model: the distribution is fixed and the scorer clamps
      // every awarded score to it.
      points: POINT_DISTRIBUTION[n],
      type,
      answer,
      ...(variants.length ? { accepted_variants: variants } : {}),
      ...(typeof entry?.scoring_notes === "string" && entry.scoring_notes.trim()
        ? { scoring_notes: entry.scoring_notes.trim() }
        : {}),
    });
  }

  const s = (obj.suggested ?? {}) as Record<string, unknown>;
  const grade = Number(s.grade);

  return {
    items,
    warnings,
    suggested: {
      subject_hint: typeof s.subject_hint === "string" ? s.subject_hint : null,
      grade: Number.isInteger(grade) && grade >= 1 && grade <= 12 ? grade : null,
      test_type: typeof s.test_type === "string" ? s.test_type : null,
      year: typeof s.year === "string" ? s.year : null,
    },
  };
}

/**
 * The gate a key must pass before it can be saved. Mirrors the checks in
 * scripts/build-gnahatum-keys-sql.mjs so the UI path and the file path cannot
 * disagree about what a valid key is.
 */
export function validateKeyForSave(items: AnswerKeyItem[]): string[] {
  const errors: string[] = [];

  if (items.length !== TOTAL_QUESTIONS) {
    errors.push(`Expected ${TOTAL_QUESTIONS} questions, got ${items.length}.`);
    return errors;
  }

  let total = 0;
  const seen = new Set<number>();

  for (const item of items) {
    if (seen.has(item.number)) errors.push(`Q${item.number} appears more than once.`);
    seen.add(item.number);

    const expected = POINT_DISTRIBUTION[item.number];
    if (expected === undefined) {
      errors.push(`Q${item.number} is not a valid question number.`);
      continue;
    }
    if (Math.abs(item.points - expected) > 0.001) {
      errors.push(`Q${item.number} is worth ${item.points}, expected ${expected}.`);
    }
    if (!(QUESTION_TYPES as readonly string[]).includes(item.type)) {
      errors.push(`Q${item.number} has an unknown type "${item.type}".`);
    }
    if (!item.answer || !item.answer.trim()) {
      errors.push(`Q${item.number} has no answer.`);
    }
    total += item.points;
  }

  if (Math.abs(total - 15) > 0.001) errors.push(`Points total ${total}, expected 15.`);

  return errors;
}

/** Pull a Drive file id out of a pasted Google Docs / Drive URL. */
export function driveFileIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  // A bare id, as Drive shows it in the address bar fragment.
  if (/^[a-zA-Z0-9_-]{20,200}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,200})/) ?? trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,200})/);
  return match ? match[1] : null;
}
