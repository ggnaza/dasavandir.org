import { hasProviderKey } from "@/lib/ai-keys";

export interface ScoringModel {
  id: string;
  name: string;
  provider: "anthropic" | "google" | "openai";
  model: string;
  description: string;
  /**
   * Whether the model accepts `media_resolution` in `generation_config`.
   *
   * Gemini-3-only. A scanned test page is rendered at ~560 tokens by default,
   * which is where handwriting misreads come from; MEDIA_RESOLUTION_HIGH
   * doubles that to ~1120. Sending the field to a 2.5 model is rejected, so
   * the scorer branches on this flag rather than sniffing the model string.
   */
  highResolutionScans?: boolean;
}

export const SCORING_MODELS: ScoringModel[] = [
  // Model ids are exact and carry no date suffix. A stale pinned id is how the
  // Gemini scorer broke once already (see fix_deprecated_gemini_model_ids.sql)
  // — when refreshing these, check them against current provider docs rather
  // than from memory. Gemini ids below verified against ai.google.dev/gemini-api/docs/models
  // on 2026-09-08; the local key is blocked for ListModels (OQ-020), so they
  // could not be confirmed against the live catalogue.
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 5",
    provider: "anthropic",
    model: "claude-sonnet-5",
    description: "Best balance of accuracy and cost for test scoring.",
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
    id: "gemini-3-8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    model: "gemini-3.8-flash",
    description: "Default for Gemini. Newest Flash, reads scans at high resolution.",
    highResolutionScans: true,
  },
  {
    id: "gemini-3-7-flash",
    name: "Gemini 3.7 Flash",
    provider: "google",
    model: "gemini-3.7-flash",
    description: "Previous-generation Flash. High-resolution scans.",
    highResolutionScans: true,
  },
  {
    id: "gemini-3-6-flash",
    name: "Gemini 3.6 Flash",
    provider: "google",
    model: "gemini-3.6-flash",
    description: "Balances speed and multimodal quality. High-resolution scans.",
    highResolutionScans: true,
  },
  {
    id: "gemini-3-1-pro",
    name: "Gemini 3.1 Pro (preview)",
    provider: "google",
    model: "gemini-3.1-pro-preview",
    description: "Google's most capable. Preview — expect stricter rate limits.",
    highResolutionScans: true,
  },
  {
    id: "gemini-3-5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    provider: "google",
    model: "gemini-3.5-flash-lite",
    description: "Cheapest Gemini 3. For high-volume runs where cost dominates.",
    highResolutionScans: true,
  },
  // OpenAI ids verified against the account's live /v1/models on 2026-09-08
  // and the current models page: these four are the flagships; gpt-5.5, 5.4,
  // o3, o4-mini and 4.1 are still callable but no longer listed, so they are
  // treated as legacy and not offered. Responses API, strict structured
  // outputs, PDF input; see lib/gnahatum/openai.ts.
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    provider: "openai",
    model: "gpt-6-astra",
    description: "OpenAI's flagship. Strongest reasoning; slowest and dearest.",
  },
  {
    id: "gpt-5-6-sol",
    name: "GPT-5.6 Sol",
    provider: "openai",
    model: "gpt-5.6-sol",
    description: "OpenAI high-end general model.",
  },
  {
    id: "gpt-5-6-terra",
    name: "GPT-5.6 Terra",
    provider: "openai",
    model: "gpt-5.6-terra",
    description: "OpenAI balanced quality and cost. Good default for OpenAI.",
  },
  {
    id: "gpt-5-6-luna",
    name: "GPT-5.6 Luna",
    provider: "openai",
    model: "gpt-5.6-luna",
    description: "OpenAI cost-optimised, for high-volume scoring.",
  },
  // Kept so results scored before the Gemini 3 rollout remain reproducible and
  // so a benchmark can compare against the model that produced them.
  {
    id: "gemini-flash",
    name: "Gemini 2.5 Flash (legacy)",
    provider: "google",
    model: "gemini-2.5-flash",
    description: "Previous default. No high-resolution scan support.",
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.5 Pro (legacy)",
    provider: "google",
    model: "gemini-2.5-pro",
    description: "Previous Gemini Pro. No high-resolution scan support.",
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
