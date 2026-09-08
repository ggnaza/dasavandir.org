/**
 * The provider-neutral shape of one model call. Types only — this module has
 * no runtime imports so the provider modules that use it can be executed
 * directly under Node (for hands-on testing) as well as through Next.
 */

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
export type ScanMediaType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export type ThinkingLevel = "low" | "medium" | "high";

export interface ModelCall {
  /** Names the call in errors and logs: a failure must say which pass it was. */
  pass: "transcription" | "grading";
  prompt: string;
  /** Present for the transcription pass only. The grading pass has no image. */
  scan?: { base64: string; mediaType: ScanMediaType };
  /** Gemini structured-output schema. Anthropic gets the JSON shape from the prompt. */
  schema: object;
  /**
   * What to send on the one retry after a runaway. Removing the free-text
   * fields is what actually stops a repetition loop; lower thinking and
   * higher temperature alone did not.
   */
  fallback?: { schema: object; promptSuffix: string };
}
