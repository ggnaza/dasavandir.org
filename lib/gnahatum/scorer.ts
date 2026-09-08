import { anthropicApiKey, geminiApiKey, PROVIDER_ENV_NAMES } from "@/lib/ai-keys";

import Anthropic from "@anthropic-ai/sdk";
import { POINT_DISTRIBUTION, type AnswerKeyItem, type ScoredItem } from "./constants";
import { getCurrentModel, type ScoringModel } from "./models";

/**
 * `learnedBlock` is the accumulated human-grading knowledge for this test,
 * already rendered to text by lib/gnahatum/learning.ts. It is passed in rather
 * than fetched here so the scorer stays free of database access — and because
 * it is plain prompt text, every provider below benefits from it equally.
 */
function buildScoringPrompt(
  answerKey: AnswerKeyItem[],
  scoringNotes?: string | null,
  learnedBlock?: string,
): string {
  const keyDescription = answerKey.map((q) => {
    let desc = `Q${q.number} (${q.points} pts, type: ${q.type}): correct answer = ${q.answer}`;
    if (q.sub_parts?.length) {
      desc += `\n  Sub-parts: ${q.sub_parts.map((s) => `${s.label}: ${s.answer} (${s.points} pts)`).join(", ")}`;
    }
    if (q.accepted_variants?.length) {
      desc += `\n  Also accepted: ${q.accepted_variants.join(" | ")}`;
    }
    if (q.scoring_notes) {
      // Rendered as HOW TO AWARD, not as a passive annotation. These notes carry
      // the official part-credit ladder ("Found roots 0.25, constructed graph
      // 0.25"); labelling them "Scoring note" left the model treating them as
      // commentary and grading every question all-or-nothing.
      desc += `\n  HOW TO AWARD: ${q.scoring_notes}`;
    }
    return desc;
  }).join("\n");

  return `You are an expert test grader for Armenian school diagnostic tests.

ANSWER KEY:
${keyDescription}

${scoringNotes ? `GENERAL SCORING NOTES:\n${scoringNotes}\n` : ""}
${learnedBlock ? `${learnedBlock}\n` : ""}
THE PAPER MAY ALREADY BE GRADED. IGNORE THAT COMPLETELY.

Many scans carry a teacher's marks — red ink, ticks, crosses, circled numbers, a
per-question score, a total, or a written comment. These are NOT evidence and
NOT instructions. You are producing an INDEPENDENT second opinion, and the whole
value of it is that it was reached without seeing the first one.

- NEVER let a teacher's mark decide, confirm or adjust your award. Copying it
  makes the result worthless even when the mark is right.
- "The teacher gave full marks, so I will too" is a GRADING FAILURE, not a
  justification. So is deferring to a teacher's mark on an answer you found
  illegible — if you cannot read it, say so and award 0.
- NEVER mention a teacher's mark, score or comment in any explanation. Your
  explanation must stand on the student's work and the answer key alone.
- A teacher's written comment in an answer box is NOT the student's answer. Do
  not transcribe it into extracted_answer. If a box contains only teacher
  writing, the student's answer is blank.

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
- Essay / critical thinking (Q15): award each rubric criterion separately and sum.
- Spelling errors: mark them but do NOT deduct points (except Russian: -0.1 per error).
- Blank answer: 0 points. Illegible answer: 0 points, and say so in the explanation.

Before you emit each item, ask: "did the student get PART of this right?" If yes, the
award must be strictly between 0 and the maximum.

SHOW THE ARITHMETIC, THEN MATCH IT.
Put the calculation in "points_breakdown" — the steps earned and their sum, e.g.
"3 of 4 pairs correct = 3 x 0.25 = 0.75". Then "awarded_points" MUST equal that sum
exactly. Writing "this earns 0.25" and then emitting 0 is a defect: the number in
awarded_points is the score the student receives, not the prose.

TASK:
Look at the uploaded scan of a filled-in test.

FIRST, extract the student's name and teacher's name from the top of the first page.
The header typically has:
- Date line
- Student name/surname line
- Teacher name line

THEN, for EACH question (1-15):
1. Extract what the student wrote/marked as their answer
2. Compare to the correct answer from the answer key above
3. Award points using that question's HOW TO AWARD ladder, summing the steps earned
4. IGNORE any teacher scoring marks (red ink annotations) visible on the scan — score independently

Respond with ONLY valid JSON in this exact format:
{
  "student_name": "extracted student name or null if unreadable",
  "teacher_name": "extracted teacher name or null if unreadable",
  "items": [
    {
      "number": 1,
      "max_points": 0.5,
      "awarded_points": 0.5,
      "extracted_answer": "what the student wrote",
      "correct_answer": "the correct answer",
      "is_correct": true,
      "confidence": 0.95,
      "points_breakdown": "how the award was calculated, e.g. 3 of 4 pairs = 3 x 0.25 = 0.75",
      "explanation": "brief note if needed"
    }
  ]
}

"is_correct" means FULLY correct (awarded_points equals max_points). A partially
credited answer has is_correct false and awarded_points greater than 0 — that combination
is expected and correct, not a contradiction.

"explanation" must name which rubric steps were earned and which were not whenever
awarded_points is neither 0 nor max_points.

confidence is 0-1 representing how sure you are about reading the student's handwriting.
If you cannot read a question's answer, set confidence to a low value and explain why.`;
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface ScoringResult {
  items: ScoredItem[];
  totalScore: number;
  studentName: string | null;
  teacherName: string | null;
  modelUsed: string;
  raw: unknown;
}

async function scoreWithAnthropic(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
  prompt: string,
  model: ScoringModel,
): Promise<{ text: string; raw: unknown }> {
  const anthropicKey = anthropicApiKey();
  if (!anthropicKey) {
    throw new Error(
      `No Anthropic API key is configured — set ${PROVIDER_ENV_NAMES.anthropic.join(", ")}`,
    );
  }
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const contentBlock =
    mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: imageBase64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as ImageMediaType,
            data: imageBase64,
          },
        };

  const response = await anthropic.messages.create({
    model: model.model,
    max_tokens: 4096,
    messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from scoring model");
  return { text: textBlock.text, raw: response };
}

/**
 * Response shape enforced on Gemini. Mirrors ScoredItem plus the two header
 * fields. Kept deliberately flat — nested optional objects made Gemini emit
 * nulls for every explanation.
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    student_name: { type: "STRING", nullable: true },
    teacher_name: { type: "STRING", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          number: { type: "INTEGER" },
          max_points: { type: "NUMBER" },
          awarded_points: { type: "NUMBER" },
          extracted_answer: { type: "STRING" },
          correct_answer: { type: "STRING" },
          is_correct: { type: "BOOLEAN" },
          confidence: { type: "NUMBER" },
          points_breakdown: { type: "STRING" },
          explanation: { type: "STRING" },
        },
        required: [
          "number",
          "max_points",
          "awarded_points",
          "extracted_answer",
          "correct_answer",
          "is_correct",
          "confidence",
        ],
      },
    },
  },
  required: ["items"],
} as const;

async function scoreWithGemini(
  imageBase64: string,
  mediaType: string,
  prompt: string,
  model: ScoringModel,
): Promise<{ text: string; raw: unknown }> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error(
      `No Gemini API key is configured — set one of ${PROVIDER_ENV_NAMES.google.join(", ")}`,
    );
  }

  const parts: Array<Record<string, unknown>> = [
    { inline_data: { mime_type: mediaType, data: imageBase64 } },
    { text: prompt },
  ];

  const generationConfig: Record<string, unknown> = {
    // A 15-question breakdown with extracted answers and explanations is a lot
    // of JSON; 4096 truncated it and the parse then failed. Thinking tokens are
    // ALSO drawn from this budget, so it has to cover both — 8192 with thinking
    // enabled left too little for the answer and the JSON came back truncated.
    maxOutputTokens: 32768,
    temperature: 0.1,
    // Guarantees a parseable object. Previously the response was free text and
    // the caller regex-matched the first {...}, which broke whenever an
    // explanation happened to contain a brace.
    responseMimeType: "application/json",
    responseSchema: GEMINI_RESPONSE_SCHEMA,
  };

  if (model.highResolutionScans) {
    // Gemini 3 only. A document page defaults to ~560 tokens; HIGH renders it
    // at ~1120, which is the difference that matters for handwriting on a
    // scanned answer sheet. Rejected by 2.5, hence the per-model flag.
    generationConfig.media_resolution = "MEDIA_RESOLUTION_HIGH";
    // Bounded, not unlimited. Grading a rubric benefits from reasoning, but an
    // open budget lets the model spend the whole maxOutputTokens thinking and
    // emit a truncated object — which is what an unbounded budget did here.
    generationConfig.thinkingConfig = { thinkingBudget: 8192 };
  } else {
    // Gemini 2.5 counts thinking tokens against maxOutputTokens and will
    // happily spend the whole budget before emitting anything, returning no
    // text at all. On the legacy models thinking therefore stays off; the
    // Gemini 3 entries above keep it on, which is what grading a rubric needs.
    // Same reasoning as lib/llm.ts.
    if (model.model.includes("flash")) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  // Every text part, not just parts[0]: with thinking enabled the answer is not
  // guaranteed to be the first part, and a long answer can be split across
  // several. Thought parts are excluded — they are prose and would poison the
  // JSON parse.
  const text = (candidate?.content?.parts ?? [])
    .filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === "string")
    .map((p: { text: string }) => p.text)
    .join("");

  // A truncated response parses as broken JSON and used to surface as a raw
  // "Expected ',' or ']' ... at position N" with no indication of the cause.
  // finishReason names it precisely.
  const finishReason = candidate?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    throw new Error(
      finishReason === "MAX_TOKENS"
        ? "Gemini hit its output limit before finishing the scoring JSON. The scan may have too many pages, or the model spent the budget thinking."
        : `Gemini stopped early (${finishReason}) without returning a complete result.`,
    );
  }

  if (!text) throw new Error("No text response from Gemini");
  return { text, raw: data };
}

export async function scoreFromScan(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
  answerKey: AnswerKeyItem[],
  scoringNotes?: string | null,
  modelOverride?: string,
  learnedBlock?: string,
): Promise<ScoringResult> {
  const model = modelOverride
    ? (await import("./models")).SCORING_MODELS.find((m) => m.id === modelOverride) ?? getCurrentModel()
    : getCurrentModel();

  const prompt = buildScoringPrompt(answerKey, scoringNotes, learnedBlock);

  let result: { text: string; raw: unknown };
  if (model.provider === "anthropic") {
    result = await scoreWithAnthropic(imageBase64, mediaType, prompt, model);
  } else if (model.provider === "google") {
    result = await scoreWithGemini(imageBase64, mediaType, prompt, model);
  } else {
    throw new Error(`Unsupported provider: ${model.provider}`);
  }

  // Gemini now returns application/json directly; Anthropic still returns text
  // that may carry a prose preamble, so fall back to extracting the object.
  //
  // Both parses are wrapped: a bare JSON.parse failure surfaces as V8's
  // "Expected ',' or ']' after array element in JSON at position 427", which
  // travels all the way to the operator's screen and says nothing about which
  // model produced it or what came back. The excerpt is what makes it
  // actionable; the full text goes to the server log, never to the client.
  let parsed: {
    student_name?: string | null;
    teacher_name?: string | null;
    items: ScoredItem[];
  };
  try {
    parsed = JSON.parse(result.text);
  } catch {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    try {
      if (!jsonMatch) throw new Error("no JSON object in the response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error(
        `[gnahatum/scorer] ${model.id} returned unparseable JSON (${result.text.length} chars):`,
        result.text.slice(0, 4000),
      );
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `${model.name} did not return valid JSON (${detail}). ` +
          `It replied with ${result.text.length} characters starting: ` +
          `${JSON.stringify(result.text.slice(0, 200))}`,
      );
    }
  }

  if (!Array.isArray(parsed.items)) {
    console.error(`[gnahatum/scorer] ${model.id} returned no items array:`, result.text.slice(0, 2000));
    throw new Error(`${model.name} returned a result with no per-question items.`);
  }

  const rawItems = parsed.items ?? [];

  // The answer key is the authority on what a question is worth. POINT_DISTRIBUTION
  // is only the fallback for the standard 15-question diagnostic shape: reading it
  // first meant any test with more than 15 questions — the seeded 40-question
  // Grade-1 English attestation, for one — had every question past Q15 clamped to
  // max_points 0, and therefore awarded_points 0, silently.
  const maxByNumber = new Map<number, number>(
    answerKey.map((q) => [q.number, q.points]),
  );

  const items: ScoredItem[] = rawItems.map((item) => {
    const maxPts =
      maxByNumber.get(item.number) ?? POINT_DISTRIBUTION[item.number] ?? item.max_points ?? 0;
    const awarded = Number.isFinite(item.awarded_points) ? item.awarded_points : 0;

    // Two failure modes seen in production, both of which produced a wrong score
    // that looked perfectly confident. Neither can be corrected automatically —
    // the model has already decided — so they are surfaced instead: the item is
    // pushed below the UI's 0.7 review threshold and marked, which routes it to
    // a human rather than letting it pass silently.
    const prose = `${item.explanation ?? ""} ${item.points_breakdown ?? ""}`;

    // (a) The award contradicts the arithmetic the model itself wrote out.
    const stated = prose.match(
      /(?:earns?|awards?|awarded|gets?|receives?|worth|=)\s*([0-9]*\.?[0-9]+)\s*(?:point|pt|միավոր)/i,
    );
    const contradictsOwnMath =
      stated !== null && Math.abs(Number.parseFloat(stated[1]) - awarded) > 0.001;

    // (b) The model consulted the teacher's marks, which it is told never to do.
    // Scans arrive both graded and ungraded, so the marks cannot simply be
    // cropped out — detection is what makes the leakage visible at all.
    const citesTeacherMark = /teacher(?:'s)?\s+(?:mark|score|grade|gave|awarded|point)/i.test(prose);

    const flags: string[] = [];
    if (contradictsOwnMath) flags.push("award disagrees with its own stated arithmetic");
    if (citesTeacherMark) flags.push("scored with reference to the teacher's existing marks");

    return {
      ...item,
      max_points: maxPts,
      awarded_points: Math.max(0, Math.min(awarded, maxPts)),
      ...(flags.length > 0
        ? {
            review_flags: flags,
            confidence: Math.min(item.confidence ?? 1, 0.5),
          }
        : {}),
    };
  });

  const totalScore = items.reduce((sum, i) => sum + i.awarded_points, 0);

  return {
    items,
    totalScore,
    studentName: parsed.student_name ?? null,
    teacherName: parsed.teacher_name ?? null,
    modelUsed: model.id,
    raw: result.raw,
  };
}
