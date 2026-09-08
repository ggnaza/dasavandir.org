import { anthropicApiKey, geminiApiKey, openaiApiKey, PROVIDER_ENV_NAMES } from "@/lib/ai-keys";

import Anthropic from "@anthropic-ai/sdk";
import { POINT_DISTRIBUTION, type AnswerKeyItem, type ScoredItem } from "./constants";
import { getCurrentModel, SCORING_MODELS, type ScoringModel } from "./models";
import type { ImageMediaType, ModelCall, ScanMediaType, ThinkingLevel } from "./model-call";
import {
  buildGradingPrompt,
  buildTranscriptionPrompt,
  GRADING_FALLBACK_SUFFIX,
  GRADING_SCHEMA,
  GRADING_SCHEMA_MINIMAL,
  TRANSCRIPTION_SCHEMA,
  type GradedItem,
  type TranscribedAnswer,
  type Transcription,
} from "./prompts";
import { callOpenAI } from "./openai";

/**
 * Scoring runs in TWO passes (ADR-0008).
 *
 *   Pass 1 — TRANSCRIBE. Sees the scan. Knows only the question structure
 *            (numbers, types, sub-part labels), never the correct answers, so
 *            reading cannot be biased toward the key. Writes down what the
 *            student wrote and nothing else.
 *
 *   Pass 2 — GRADE. Sees the transcript, the answer key with its rubrics, and
 *            the learned knowledge. NEVER sees the image.
 *
 * The split exists for one reason: scans arrive already marked by teachers,
 * and in production the single-pass scorer was caught deriving awards from
 * the red ink ("the teacher awarded full points, so I will follow that"). A
 * grader that never sees the page cannot do that. It also makes hand-graded
 * papers safe to use as a benchmark gold set.
 */

// ---------------------------------------------------------------------------
// Provider calls
// ---------------------------------------------------------------------------

async function callAnthropic(
  call: ModelCall,
  model: ScoringModel,
): Promise<{ text: string; raw: unknown }> {
  const anthropicKey = anthropicApiKey();
  if (!anthropicKey) {
    throw new Error(
      `No Anthropic API key is configured — set ${PROVIDER_ENV_NAMES.anthropic.join(", ")}`,
    );
  }
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const content: Anthropic.MessageParam["content"] = [];
  if (call.scan) {
    content.push(
      call.scan.mediaType === "application/pdf"
        ? {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: call.scan.base64,
            },
          }
        : {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: call.scan.mediaType as ImageMediaType,
              data: call.scan.base64,
            },
          },
    );
  }
  content.push({ type: "text", text: call.prompt });

  const response = await anthropic.messages.create({
    model: model.model,
    max_tokens: 8192,
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`${model.name} returned no text in the ${call.pass} pass`);
  }
  return { text: textBlock.text, raw: response };
}

async function callGemini(
  call: ModelCall,
  model: ScoringModel,
): Promise<{ text: string; raw: unknown }> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error(
      `No Gemini API key is configured — set one of ${PROVIDER_ENV_NAMES.google.join(", ")}`,
    );
  }

  // Transcription is reading, not reasoning: "low" is enough and it is the pass
  // where thinking ran away (5.5k thought tokens on a *successful* run). Grading
  // applies a rubric and gets the default. Both fall back to "low" on a retry.
  const preferredLevel: ThinkingLevel = call.pass === "transcription" ? "low" : "medium";

  const attempt = async (
    level: ThinkingLevel,
    temperature: number,
    schema: object,
    prompt: string,
    label: string,
  ) => {
    const parts: Array<Record<string, unknown>> = [];
    if (call.scan) {
      parts.push({ inline_data: { mime_type: call.scan.mediaType, data: call.scan.base64 } });
    }
    parts.push({ text: prompt });

    const generationConfig: Record<string, unknown> = {
      // A 15-question breakdown with extracted answers and explanations is a lot
      // of JSON; 4096 truncated it and the parse then failed. Thinking tokens are
      // ALSO drawn from this budget, so it has to cover both. Transcription can
      // legitimately be long (verbatim Armenian is token-heavy); a healthy
      // grading answer is ~1.7k tokens, so its ceiling is lower — a runaway
      // there is a repetition loop, and a lower cap makes it fail at half the
      // cost rather than "succeed" at 32k.
      // One ceiling for both passes. #345 lowered grading to 16384 and every
      // grading call began returning 400 INVALID_ARGUMENT with no details; the
      // transcription pass, unchanged at 32768, kept working. Restored to the
      // shape that graded successfully. The loop protection that matters is the
      // temperature retry below, not the cap.
      maxOutputTokens: 32768,
      temperature,
      // Guarantees a parseable object. Previously the response was free text and
      // the caller regex-matched the first {...}, which broke whenever an
      // explanation happened to contain a brace.
      responseMimeType: "application/json",
      responseSchema: schema,
    };

    if (model.highResolutionScans) {
      if (call.scan) {
        // Gemini 3 only. A document page defaults to ~560 tokens; HIGH renders it
        // at ~1120, which is the difference that matters for handwriting on a
        // scanned answer sheet. Rejected by 2.5, hence the per-model flag.
        generationConfig.media_resolution = "MEDIA_RESOLUTION_HIGH";
      }
      // Gemini 3 is steered with thinkingLevel, NOT thinkingBudget. A budget was
      // sent here once; the docs say it "may result in unexpected performance"
      // on Gemini 3, and what that meant in practice was the cap being ignored,
      // thinking running to ~30k tokens and the JSON arriving truncated
      // (MAX_TOKENS) or not at all. There is no "off" on Gemini 3 — "low" is the
      // floor.
      generationConfig.thinkingConfig = { thinkingLevel: level };
    } else if (model.model.includes("flash")) {
      // Gemini 2.5 counts thinking tokens against maxOutputTokens and will
      // happily spend the whole budget before emitting anything, returning no
      // text at all. On the legacy models thinking therefore stays off.
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
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
      // Google's 400 body is often just "Request contains an invalid argument."
      // with no field named. The only way to know what it objected to is to
      // see what was sent, so the config travels with the error (the prompt
      // and scan bytes do not — they are large and never the cause of a 400).
      const sent = JSON.stringify({
        model: model.model,
        pass: call.pass,
        hasScan: !!call.scan,
        generationConfig: { ...generationConfig, responseSchema: "<schema omitted>" },
        schemaKeys: Object.keys((schema as { properties?: object }).properties ?? {}),
      });
      throw new Error(
        `Gemini API error in the ${call.pass} pass: ${response.status} ${err.trim()} — sent: ${sent}`,
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const allParts: Array<{ thought?: boolean; text?: string }> = candidate?.content?.parts ?? [];

    // Every text part, not just parts[0]: with thinking enabled the answer is not
    // guaranteed to be the first part, and a long answer can be split across
    // several. Thought parts are excluded — they are prose and would poison the
    // JSON parse.
    const text = allParts
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");

    // Everything needed to explain a failure after the fact. "No text response"
    // on its own said nothing about whether the model thought itself out of
    // budget, was blocked, or returned only thoughts.
    const usage = data.usageMetadata ?? {};
    const where =
      `${model.name}, ${call.pass} pass (${label}), thinking=${level}, temperature=${temperature}` +
      ` — finish=${candidate?.finishReason ?? "none"}` +
      (data.promptFeedback?.blockReason ? `, blocked=${data.promptFeedback.blockReason}` : "") +
      `, parts=${allParts.length} (thought ${allParts.filter((p) => p.thought).length})` +
      `, tokens: thoughts=${usage.thoughtsTokenCount ?? "?"} answer=${usage.candidatesTokenCount ?? "?"}`;

    return { text, raw: data, finishReason: candidate?.finishReason as string | undefined, where };
  };

  let result = await attempt(preferredLevel, 0.1, call.schema, call.prompt, "full schema");

  // Two distinct ways a call ends MAX_TOKENS, told apart by where the tokens
  // went (the `where` string carries both counts):
  //   thoughts high, answer small  → thinking ran away; lower the level.
  //   thoughts ~0, answer at cap   → the ANSWER ran away: a repetition loop
  //                                  inside the JSON, which structured output
  //                                  at temperature 0.1 is prone to. Seen in
  //                                  production as answer=32753 on the grading
  //                                  pass with thoughts=0. Lowering thinking
  //                                  does nothing for that; a higher
  //                                  temperature is what breaks the loop.
  // One retry covers both: floor thinking AND raise temperature.
  const exhausted = (r: typeof result) => r.finishReason === "MAX_TOKENS" || !r.text;
  if (exhausted(result) && model.highResolutionScans) {
    console.warn(
      `[gnahatum/scorer] retrying (${call.fallback ? "minimal schema" : "same schema"}): ${result.where}` +
        ` — tail of output: ${JSON.stringify(result.text.slice(-400))}`,
    );
    result = call.fallback
      ? await attempt("low", 0.6, call.fallback.schema, call.prompt + call.fallback.promptSuffix, "minimal schema")
      : await attempt("low", 0.6, call.schema, call.prompt, "same schema");
  }

  // A truncated response parses as broken JSON and used to surface as a raw
  // "Expected ',' or ']' ... at position N" with no indication of the cause.
  // finishReason names it precisely — and on a runaway, the tail of what the
  // model was emitting is the only evidence of what it got stuck on, so it
  // travels with the error (into scans.error_text) rather than being dropped.
  if (result.finishReason && result.finishReason !== "STOP") {
    const tail = result.text.length > 0 ? ` Output ended: ${JSON.stringify(result.text.slice(-300))}` : "";
    console.error(`[gnahatum/scorer] ${result.where} — head: ${JSON.stringify(result.text.slice(0, 1500))} … tail: ${JSON.stringify(result.text.slice(-1500))}`);
    throw new Error(
      result.finishReason === "MAX_TOKENS"
        ? `Gemini ran out of output tokens before finishing (${result.where}).${tail}`
        : `Gemini stopped early without a complete result (${result.where}).${tail}`,
    );
  }

  if (!result.text) throw new Error(`Gemini returned no answer text (${result.where}).`);
  return { text: result.text, raw: result.raw };
}

async function callModel(call: ModelCall, model: ScoringModel) {
  if (model.provider === "anthropic") return callAnthropic(call, model);
  if (model.provider === "google") return callGemini(call, model);
  if (model.provider === "openai") {
    const key = openaiApiKey();
    if (!key) {
      throw new Error(`No OpenAI API key is configured — set ${PROVIDER_ENV_NAMES.openai.join(", ")}`);
    }
    return callOpenAI(call, model, key);
  }
  throw new Error(`Unsupported provider: ${model.provider}`);
}

/**
 * Parse a model reply as JSON. Gemini returns application/json directly;
 * Anthropic returns text that may carry a prose preamble, so fall back to
 * extracting the object.
 *
 * Both parses are wrapped: a bare JSON.parse failure surfaces as V8's
 * "Expected ',' or ']' after array element in JSON at position 427", which
 * travels all the way to the operator's screen and says nothing about which
 * model or pass produced it. The excerpt is what makes it actionable; the full
 * text goes to the server log, never to the client.
 */
function parseModelJson<T>(text: string, model: ScoringModel, pass: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    try {
      if (!jsonMatch) throw new Error("no JSON object in the response");
      return JSON.parse(jsonMatch[0]) as T;
    } catch (err) {
      console.error(
        `[gnahatum/scorer] ${model.id} ${pass} returned unparseable JSON (${text.length} chars):`,
        text.slice(0, 4000),
      );
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `${model.name} did not return valid JSON in the ${pass} pass (${detail}). ` +
          `It replied with ${text.length} characters starting: ${JSON.stringify(text.slice(0, 200))}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface ScoringResult {
  items: ScoredItem[];
  totalScore: number;
  studentName: string | null;
  teacherName: string | null;
  modelUsed: string;
  raw: unknown;
}

const TEACHER_MARK_PATTERN = /teacher(?:'s)?\s+(?:mark|score|grade|gave|awarded|point|comment|note)|red (?:ink|pen)/i;

export async function scoreFromScan(
  imageBase64: string,
  mediaType: ScanMediaType,
  answerKey: AnswerKeyItem[],
  scoringNotes?: string | null,
  modelOverride?: string,
  learnedBlock?: string,
): Promise<ScoringResult> {
  const model = modelOverride
    ? SCORING_MODELS.find((m) => m.id === modelOverride) ?? getCurrentModel()
    : getCurrentModel();

  // ---- Pass 1: read the paper --------------------------------------------
  const transcriptionReply = await callModel(
    {
      pass: "transcription",
      prompt: buildTranscriptionPrompt(answerKey),
      scan: { base64: imageBase64, mediaType },
      schema: TRANSCRIPTION_SCHEMA,
    },
    model,
  );
  const transcription = parseModelJson<Transcription>(transcriptionReply.text, model, "transcription");
  if (!Array.isArray(transcription.answers)) {
    throw new Error(`${model.name} returned a transcription with no answers array.`);
  }

  // One entry per question in the key, in key order, whatever the model sent.
  // A question the model skipped is recorded as unread, not silently dropped.
  const transcriptByNumber = new Map(transcription.answers.map((a) => [a.number, a]));
  const transcript: TranscribedAnswer[] = answerKey.map((q) => {
    const a = transcriptByNumber.get(q.number);
    return {
      number: q.number,
      student_answer: typeof a?.student_answer === "string" ? a.student_answer : "[illegible]",
      legibility: a && Number.isFinite(a.legibility) ? Math.max(0, Math.min(1, a.legibility)) : 0,
      notes: a?.notes,
    };
  });

  // ---- Pass 2: grade the transcript, image withheld ---------------------
  const gradingReply = await callModel(
    {
      pass: "grading",
      prompt: buildGradingPrompt(answerKey, transcript, scoringNotes, learnedBlock),
      schema: GRADING_SCHEMA,
      fallback: { schema: GRADING_SCHEMA_MINIMAL, promptSuffix: GRADING_FALLBACK_SUFFIX },
    },
    model,
  );
  const grading = parseModelJson<{ items: GradedItem[] }>(gradingReply.text, model, "grading");
  if (!Array.isArray(grading.items)) {
    throw new Error(`${model.name} returned a grading result with no per-question items.`);
  }
  const gradedByNumber = new Map(grading.items.map((g) => [g.number, g]));

  // ---- Merge -------------------------------------------------------------
  // The answer key is the authority on what a question is worth. POINT_DISTRIBUTION
  // is only the fallback for the standard 15-question diagnostic shape: reading it
  // first meant any test with more than 15 questions — the seeded 40-question
  // Grade-1 English attestation, for one — had every question past Q15 clamped to
  // max_points 0, and therefore awarded_points 0, silently.
  const keyByNumber = new Map(answerKey.map((q) => [q.number, q]));

  const items: ScoredItem[] = transcript.map((t) => {
    const key = keyByNumber.get(t.number)!;
    const graded = gradedByNumber.get(t.number);
    const maxPts = key.points ?? POINT_DISTRIBUTION[t.number] ?? 0;
    const awarded =
      graded && Number.isFinite(graded.awarded_points) ? graded.awarded_points : 0;
    const clamped = Math.max(0, Math.min(awarded, maxPts));

    // Two failure modes seen in production, both of which produced a wrong score
    // that looked perfectly confident. Neither can be corrected automatically —
    // the model has already decided — so they are surfaced instead: the item is
    // pushed below the UI's 0.7 review threshold and marked, which routes it to
    // a human rather than letting it pass silently.
    const prose = `${graded?.explanation ?? ""} ${graded?.points_breakdown ?? ""}`;

    // (a) The award contradicts the arithmetic the model itself wrote out.
    const stated = prose.match(
      /(?:earns?|awards?|awarded|gets?|receives?|worth|=)\s*([0-9]*\.?[0-9]+)\s*(?:point|pt|միավոր)/i,
    );
    const contradictsOwnMath =
      stated !== null && Math.abs(Number.parseFloat(stated[1]) - awarded) > 0.001;

    // (b) A teacher's mark reached the text. The grader cannot see the page, so
    // the only route left is the transcription pass carrying it across — which
    // it is told never to do. Detection is what makes the residual risk visible.
    const citesTeacherMark =
      TEACHER_MARK_PATTERN.test(prose) ||
      TEACHER_MARK_PATTERN.test(t.notes ?? "") ||
      TEACHER_MARK_PATTERN.test(t.student_answer);

    const flags: string[] = [];
    if (!graded) flags.push("the grading pass returned nothing for this question");
    if (contradictsOwnMath) flags.push("award disagrees with its own stated arithmetic");
    if (citesTeacherMark) flags.push("a teacher's mark leaked into the transcript or grading");

    // Reading confidence and judging confidence are different things; the
    // item is only as trustworthy as the weaker of the two.
    const gradingConfidence =
      graded && Number.isFinite(graded.confidence) ? Math.max(0, Math.min(1, graded.confidence)) : 0;
    const confidence = Math.min(t.legibility, gradingConfidence);

    return {
      number: t.number,
      max_points: maxPts,
      awarded_points: clamped,
      extracted_answer: t.student_answer,
      correct_answer: key.answer,
      is_correct: graded?.is_correct ?? false,
      legibility: t.legibility,
      confidence: flags.length > 0 ? Math.min(confidence, 0.5) : confidence,
      points_breakdown: graded?.points_breakdown,
      explanation:
        graded?.explanation ??
        (graded ? "Scored without explanation: the first attempt ran away repeating itself, so this paper was re-graded with a numbers-only schema." : undefined),
      ...(flags.length > 0 ? { review_flags: flags } : {}),
    };
  });

  const totalScore = items.reduce((sum, i) => sum + i.awarded_points, 0);

  return {
    items,
    totalScore,
    studentName: transcription.student_name ?? null,
    teacherName: transcription.teacher_name ?? null,
    modelUsed: model.id,
    raw: { transcription: transcriptionReply.raw, grading: gradingReply.raw },
  };
}
