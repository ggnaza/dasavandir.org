import { z } from "zod";
import { ANSWER_TYPES, SCORING_MODES, type AnswerType, type Correct } from "@/lib/attestation-core";

export const choiceSchema = z.object({
  id: z.string().trim().min(1).max(20),
  text: z.string().max(5000),
});

export const testInputSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  year: z.string().trim().max(20).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  time_limit_minutes: z.number().int().min(1).max(600).nullable().optional(),
  max_attempts: z.number().int().min(1).max(20).optional(),
  source_note: z.string().max(2000).nullable().optional(),
});

export const questionInputSchema = z.object({
  number: z.string().trim().min(1).max(20),
  answer_type: z.enum(ANSWER_TYPES),
  prompt: z.string().max(20000),
  options: z.array(choiceSchema).max(40).default([]),
  match_slots: z.array(choiceSchema).max(40).default([]),
  passage_id: z.string().uuid().nullable().optional(),
  image_path: z.string().max(500).nullable().optional(),
  correct: z.unknown().optional(),
  points: z.number().positive().max(100).default(1),
  scoring: z.enum(SCORING_MODES).default("all_or_nothing"),
  needs_review: z.boolean().default(false),
  review_note: z.string().max(2000).nullable().optional(),
  position: z.number().int().min(0).max(10000).optional(),
});

export const passageInputSchema = z.object({
  label: z.string().max(200).nullable().optional(),
  body: z.string().max(50000),
  image_path: z.string().max(500).nullable().optional(),
  position: z.number().int().min(0).max(10000).optional(),
});

const ids = z.array(z.string().min(1).max(20)).max(40);

/**
 * Shape-check a correct answer (or learner response) for its type. Returns the
 * typed value, null for "not set", or throws a readable message.
 */
export function coerceCorrect(type: AnswerType, value: unknown): Correct | null {
  if (value === undefined || value === null || value === "") return null;
  switch (type) {
    case "single":
      return z.string().min(1).max(20).parse(value);
    case "multi":
    case "order":
      return ids.parse(value);
    case "match":
      return z.record(z.string().min(1).max(20), z.string().max(20)).parse(value);
    case "numeric":
    case "short_text":
      return z.array(z.string().max(500)).max(20).parse(value);
  }
}

/** A learner's response for one question; same shapes, except numeric/short_text are one string. */
export function coerceResponse(type: AnswerType, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  switch (type) {
    case "single":
    case "numeric":
    case "short_text":
      return z.string().max(1000).parse(value);
    case "multi":
    case "order":
      return ids.parse(value);
    case "match":
      return z.record(z.string().min(1).max(20), z.string().max(20)).parse(value);
  }
}

/** The JSON bundle an admin imports to create a whole test at once. */
export const bundleSchema = z.object({
  test: testInputSchema,
  passages: z
    .array(passageInputSchema.extend({ key: z.string().min(1).max(50) }))
    .max(200)
    .default([]),
  questions: z
    .array(
      questionInputSchema.omit({ passage_id: true }).extend({
        passage_key: z.string().max(50).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export type Bundle = z.infer<typeof bundleSchema>;
