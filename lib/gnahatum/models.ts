import { hasProviderKey } from "@/lib/ai-keys";

export interface ScoringModel {
  id: string;
  name: string;
  provider: "anthropic" | "google" | "openai";
  model: string;
  description: string;
}

export const SCORING_MODELS: ScoringModel[] = [
  // Model ids are exact and carry no date suffix. A stale pinned id is how the
  // Gemini scorer broke once already (see fix_deprecated_gemini_model_ids.sql)
  // — when refreshing these, check them against current provider docs rather
  // than from memory.
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 5",
    provider: "anthropic",
    model: "claude-sonnet-5",
    description: "Default. Best balance of accuracy and cost for test scoring.",
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    description: "Faster and cheaper, good for high-volume scoring.",
  },
  {
    id: "claude-opus",
    name: "Claude Opus 5",
    provider: "anthropic",
    model: "claude-opus-5",
    description: "Most capable. Best for complex or ambiguous handwriting.",
  },
  {
    id: "gemini-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    model: "gemini-2.5-flash",
    description: "Google's fast model.",
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    model: "gemini-2.5-pro",
    description: "Google's most capable model.",
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet";

let currentModelId: string = DEFAULT_MODEL_ID;

/**
 * The model to score with when the caller names none.
 *
 * Must prefer a model whose provider key actually exists. Returning the
 * hardcoded Claude default on a deployment with only a Gemini key sent every
 * unqualified request to Anthropic and failed with "No Anthropic API key",
 * which reads as a bug in the picker rather than a missing key.
 *
 * Falls back to the declared default only when nothing is configured at all —
 * the scorer then raises a precise, provider-named error.
 */
export function getCurrentModel(): ScoringModel {
  const available = getAvailableModels();
  return (
    available.find((m) => m.id === currentModelId) ??
    available[0] ??
    SCORING_MODELS.find((m) => m.id === currentModelId) ??
    SCORING_MODELS[0]
  );
}

export function setCurrentModel(modelId: string): void {
  const model = SCORING_MODELS.find((m) => m.id === modelId);
  if (model) currentModelId = modelId;
}

export function getAvailableModels(): ScoringModel[] {
  return SCORING_MODELS.filter((m) => hasProviderKey(m.provider));
}
