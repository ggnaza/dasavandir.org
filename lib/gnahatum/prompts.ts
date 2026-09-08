/**
 * The two scoring prompts and their response schemas (ADR-0008).
 *
 * Kept free of runtime imports on purpose: a Node harness can import this
 * file directly and run the real prompts against a real provider on a real
 * scan, which is the only hands-on acceptance the scorer has.
 */
import type { AnswerKeyItem } from "./constants";

// ---------------------------------------------------------------------------
// Pass 1 — transcription
// ---------------------------------------------------------------------------

export function buildTranscriptionPrompt(answerKey: AnswerKeyItem[]): string {
  // Structure only. The correct answers are deliberately withheld: a reader
  // who knows what the answer "should" be reads it into ambiguous handwriting.
  const structure = answerKey
    .map((q) => {
      let line = `Q${q.number} — type: ${q.type}`;
      if (q.sub_parts?.length) {
        line += ` — parts: ${q.sub_parts.map((s) => s.label).join(", ")}`;
      }
      return line;
    })
    .join("\n");

  return `You are transcribing a scanned, hand-filled Armenian school test. Your ONLY job is to
write down exactly what THE STUDENT wrote or drew for each question. You are NOT grading.
You do not know the correct answers and must not guess at them.

QUESTIONS ON THIS PAPER:
${structure}

THE PAPER MAY ALREADY BE MARKED BY A TEACHER. THAT WRITING IS NOT THE STUDENT'S.
Teacher marks look like: red or different-coloured ink, ticks, crosses, underlines or strikes
through the student's text, circled or written numbers next to answers, a total score, and
written comments (often at the end, e.g. "Շնորհակալություն…", "Ուշադիր…").
- Do NOT transcribe any of it. If a box contains only teacher writing, the student's answer is blank.
- Do NOT mention teacher marks anywhere in your output — not in the answer, not in the notes.
- If a student's word has been struck through by a teacher, transcribe the student's word anyway;
  the strike is a mark, not a deletion by the student.

TRANSCRIPTION RULES:
- Copy the student's words as written, including spelling mistakes. Do not correct or normalise.
- Multi-part questions (ա, բ, գ…): give each part on its own line, labelled. A part with nothing
  written is "[blank]".
- Matching / table questions: list every pairing the student made, one per line ("Տերև → գ").
- Multiple choice: state which option(s) the student circled, ticked or underlined, and quote any
  text they wrote alongside.
- Drawings and diagrams: describe what is drawn in enough detail that someone who cannot see it
  could judge it — subject, labelled parts, arrows, quantities. Include any caption or name.
- Numbers, formulas, units: transcribe precisely; a wrong digit changes the grade.
- Truly illegible: write "[illegible]" for that part and set legibility low. Never invent a
  plausible word to fill a gap.

Also read the header: the student's name and the teacher's name are usually on labelled lines at
the top of the first page.

legibility is 0-1: how sure you are that you have read the student's writing correctly.

Respond with ONLY valid JSON:
{
  "student_name": "as written, or null",
  "teacher_name": "as written, or null",
  "answers": [
    { "number": 1, "student_answer": "verbatim transcription", "legibility": 0.95, "notes": "" }
  ]
}
Include every question number listed above, in order, even when the answer is "[blank]".`;
}

export const TRANSCRIPTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    student_name: { type: "STRING", nullable: true },
    teacher_name: { type: "STRING", nullable: true },
    answers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          number: { type: "INTEGER" },
          student_answer: { type: "STRING" },
          legibility: { type: "NUMBER" },
          notes: { type: "STRING" },
        },
        required: ["number", "student_answer", "legibility"],
      },
    },
  },
  required: ["answers"],
} as const;

export interface TranscribedAnswer {
  number: number;
  student_answer: string;
  legibility: number;
  notes?: string;
}

export interface Transcription {
  student_name?: string | null;
  teacher_name?: string | null;
  answers: TranscribedAnswer[];
}

// ---------------------------------------------------------------------------
// Pass 2 — grading (text only)
// ---------------------------------------------------------------------------

/**
 * `learnedBlock` is the accumulated human-grading knowledge for this test,
 * already rendered to text by lib/gnahatum/learning.ts. It is passed in rather
 * than fetched here so the scorer stays free of database access — and because
 * it is plain prompt text, every provider benefits from it equally.
 */
export function buildGradingPrompt(
  answerKey: AnswerKeyItem[],
  transcript: TranscribedAnswer[],
  scoringNotes?: string | null,
  learnedBlock?: string,
): string {
  const keyDescription = answerKey
    .map((q) => {
      let desc = `Q${q.number} (${q.points} pts, type: ${q.type}): correct answer = ${q.answer}`;
      if (q.sub_parts?.length) {
        desc += `\n  Sub-parts: ${q.sub_parts.map((s) => `${s.label}: ${s.answer} (${s.points} pts)`).join(", ")}`;
      }
      if (q.accepted_variants?.length) {
        desc += `\n  Also accepted: ${q.accepted_variants.join(" | ")}`;
      }
      if (q.scoring_notes) {
        // Rendered as HOW TO AWARD, not as a passive annotation. These notes
        // carry the official part-credit ladder ("Found roots 0.25, constructed
        // graph 0.25"); labelling them "Scoring note" left the model treating
        // them as commentary and grading every question all-or-nothing.
        desc += `\n  HOW TO AWARD: ${q.scoring_notes}`;
      }
      return desc;
    })
    .join("\n");

  const transcriptText = transcript
    .map((a) => {
      const legibility = a.legibility < 0.7 ? ` [legibility ${Math.round(a.legibility * 100)}%]` : "";
      return `Q${a.number}${legibility}:\n${a.student_answer.trim() || "[blank]"}`;
    })
    .join("\n\n");

  return `You are an expert grader for Armenian school diagnostic tests.

You are grading from a TRANSCRIPT of the student's answers. You have not seen the paper and there
are no teacher marks to consult — grade the transcript against the answer key and nothing else.

ANSWER KEY:
${keyDescription}

${scoringNotes ? `GENERAL SCORING NOTES:\n${scoringNotes}\n` : ""}
${learnedBlock ? `${learnedBlock}\n` : ""}
SCORING RULES:

PARTIAL CREDIT IS THE NORM, NOT THE EXCEPTION.
Most questions are worth more than one scoring step. Grading a question all-or-nothing
when its HOW TO AWARD line lists separate steps is a grading ERROR.

- The points shown per question above are the MAXIMUM for that question, not the only
  value you may award. Any multiple of 0.25 from 0 up to that maximum is a valid award:
  for a 1-point question that means 0, 0.25, 0.5, 0.75 or 1.
- When a question has a HOW TO AWARD line, that line is the authoritative rubric.
  Award each listed step independently and sum them. Do not round the sum.
  Example: HOW TO AWARD "Found roots 0.25, constructed graph 0.25" on a student who
  found the roots but drew no graph = 0.25, NOT 0 and NOT 0.5.
- When a question has sub-parts, award each sub-part its own points and sum them.
- When a question has no HOW TO AWARD line, split its maximum evenly across the
  distinct things the correct answer requires, in steps of 0.25.
- Matching / classification: award proportionally per correct pair. 3 of 4 pairs correct
  on a 1-point question = 0.75. ONE correct pair out of four still earns 0.25 — awarding
  0 because most pairs were wrong is the single most common grading error on these.
  This holds even when the student wrote their own wording instead of the given labels:
  grade what they meant, not whether they copied the option letter.
- Computation: accept the correct final answer, OR correct method with an arithmetic
  slip — award the method its share and withhold only the step that is wrong.
- Essay / critical thinking (Q15): award each rubric criterion separately and sum. A drawing
  is described in words in the transcript; grade the description on its content.
- Spelling errors: mark them but do NOT deduct points (except Russian: -0.1 per error).
- Blank answer: 0 points. "[illegible]": 0 points for that part, and say so.

Before you emit each item, ask: "did the student get PART of this right?" If yes, the
award must be strictly between 0 and the maximum.

SHOW THE ARITHMETIC, THEN MATCH IT.
Put the calculation in "points_breakdown" — the steps earned and their sum, e.g.
"3 of 4 pairs correct = 3 x 0.25 = 0.75". Then "awarded_points" MUST equal that sum
exactly. Writing "this earns 0.25" and then emitting 0 is a defect: the number in
awarded_points is the score the student receives, not the prose.

KEEP EVERY TEXT FIELD SHORT. "points_breakdown" is ONE line of arithmetic, under 80
characters, no commentary. "explanation" is at most two sentences. Never repeat a
sentence or a phrase; once the calculation is stated, close the string.

STUDENT'S TRANSCRIBED ANSWERS:
${transcriptText}

Respond with ONLY valid JSON in this exact format:
{
  "items": [
    {
      "number": 1,
      "awarded_points": 0.25,
      "is_correct": false,
      "confidence": 0.9,
      "points_breakdown": "how the award was calculated, e.g. 3 of 4 pairs = 3 x 0.25 = 0.75",
      "explanation": "which rubric steps were earned and which were not"
    }
  ]
}

"is_correct" means FULLY correct (awarded_points equals the maximum). A partially
credited answer has is_correct false and awarded_points greater than 0 — that combination
is expected and correct, not a contradiction.

"explanation" must name which rubric steps were earned and which were not whenever
awarded_points is neither 0 nor the maximum.

confidence is 0-1: how sure you are of the GRADING decision, given the transcript.
Include every question number from the transcript, in order.`;
}

export const GRADING_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          number: { type: "INTEGER" },
          awarded_points: { type: "NUMBER" },
          is_correct: { type: "BOOLEAN" },
          confidence: { type: "NUMBER" },
          points_breakdown: { type: "STRING" },
          explanation: { type: "STRING" },
        },
        required: ["number", "awarded_points", "is_correct", "confidence"],
      },
    },
  },
  required: ["items"],
} as const;

/**
 * The grading schema with every free-text field removed. A string field can
 * loop — in production the model padded points_breakdown with the same
 * sentence until it hit the 32k ceiling, on the retry as well as the first
 * attempt. A number or a boolean cannot loop. When the full schema runs away,
 * the scan is re-graded against this one: the student still gets a score,
 * that one result just carries no prose.
 */
export const GRADING_SCHEMA_MINIMAL = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          number: { type: "INTEGER" },
          awarded_points: { type: "NUMBER" },
          is_correct: { type: "BOOLEAN" },
          confidence: { type: "NUMBER" },
        },
        required: ["number", "awarded_points", "is_correct", "confidence"],
      },
    },
  },
  required: ["items"],
} as const;

export const GRADING_FALLBACK_SUFFIX = `

FALLBACK MODE: your previous attempt ran out of space repeating itself. This time output
ONLY number, awarded_points, is_correct and confidence for each question. No
points_breakdown, no explanation, no other text. Apply the same scoring rules.`;

export interface GradedItem {
  number: number;
  awarded_points: number;
  is_correct: boolean;
  confidence: number;
  points_breakdown?: string;
  explanation?: string;
}
