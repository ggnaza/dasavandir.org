// Safe to import from client components — no Node.js dependencies

export const AI_MODELS = [
  { id: "gpt-4o-mini",                    label: "GPT-4o mini",      note: "Fast & affordable",  provider: "OpenAI" },
  { id: "gpt-4o",                         label: "GPT-4o",            note: "High quality",       provider: "OpenAI" },
  { id: "gemini-2.0-flash",               label: "Gemini 2.0 Flash",  note: "Fast",               provider: "Google" },
  { id: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash",  note: "Smarter, fast",      provider: "Google" },
  { id: "gemini-2.5-pro-preview-05-06",   label: "Gemini 2.5 Pro",    note: "Most capable",       provider: "Google" },
  { id: "claude-haiku-4-5-20251001",      label: "Claude Haiku 4.5",  note: "Fast & affordable",  provider: "Anthropic" },
  { id: "claude-sonnet-4-6",              label: "Claude Sonnet 4.6", note: "Smarter, fast",      provider: "Anthropic" },
  { id: "claude-opus-4-7",               label: "Claude Opus 4.7",   note: "Most capable",       provider: "Anthropic" },
] as const;

export type AIModelId = (typeof AI_MODELS)[number]["id"];

export const VALID_MODEL_IDS = AI_MODELS.map((m) => m.id) as [AIModelId, ...AIModelId[]];
