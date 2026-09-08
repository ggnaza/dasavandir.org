import OpenAI from "openai";
import type { ModelCall } from "./model-call";
import type { ScoringModel } from "./models";

/**
 * OpenAI provider for the two-pass scorer (ADR-0008).
 *
 * Runtime import is `openai` only; everything else is type-only, so this file
 * runs directly under Node for a hands-on test against a real scan — the
 * Gemini and Anthropic paths could never be exercised from here (OQ-020).
 *
 * Responses API, structured outputs in strict mode. Strict mode has its own
 * schema dialect: lowercase types, every object `additionalProperties: false`
 * with ALL keys in `required`, nullability as a type array, and no
 * maxItems/minItems/maxLength. The scorer's schemas are written in Gemini's
 * dialect, so they are converted here rather than maintained twice.
 */

type JsonSchema = Record<string, unknown>;

export function toOpenAIStrictSchema(schema: unknown): JsonSchema {
  if (!schema || typeof schema !== "object") return {};
  const src = schema as JsonSchema;
  const out: JsonSchema = {};

  const rawType = typeof src.type === "string" ? src.type.toLowerCase() : undefined;
  if (rawType) out.type = src.nullable === true ? [rawType, "null"] : rawType;
  if (typeof src.description === "string") out.description = src.description;
  if (Array.isArray(src.enum)) out.enum = src.enum;

  if (rawType === "object" && src.properties && typeof src.properties === "object") {
    const props = src.properties as Record<string, unknown>;
    out.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, toOpenAIStrictSchema(v)]),
    );
    // Strict mode: every key required, none extra. Optional fields in the
    // Gemini dialect become "required but nullable" here — the model must
    // emit them, and may emit null.
    out.required = Object.keys(props);
    out.additionalProperties = false;
    for (const k of Object.keys(props)) {
      const wasRequired = Array.isArray(src.required) && (src.required as string[]).includes(k);
      const child = (out.properties as Record<string, JsonSchema>)[k];
      if (!wasRequired && typeof child.type === "string") child.type = [child.type, "null"];
    }
  }

  if (rawType === "array" && src.items) out.items = toOpenAIStrictSchema(src.items);
  return out;
}

const MAX_OUTPUT_TOKENS = 32768;

export async function callOpenAI(
  call: ModelCall,
  model: ScoringModel,
  apiKey: string,
): Promise<{ text: string; raw: unknown }> {
  // Grading with reasoning on a long transcript can take a while; the SDK's
  // default 10-minute ceiling is fine, but the route's maxDuration is 300s,
  // so fail before Vercel does and leave the scan in a reportable state.
  const client = new OpenAI({ apiKey, timeout: 280_000 });

  const content: Array<Record<string, unknown>> = [];
  if (call.scan) {
    content.push(
      call.scan.mediaType === "application/pdf"
        ? {
            type: "input_file",
            filename: "scan.pdf",
            file_data: `data:application/pdf;base64,${call.scan.base64}`,
          }
        : {
            type: "input_image",
            image_url: `data:${call.scan.mediaType};base64,${call.scan.base64}`,
            detail: "high",
          },
    );
  }

  // Transcription is reading, not reasoning; grading applies a rubric. Same
  // split as the Gemini thinking levels, for the same reasons.
  const effort = call.pass === "transcription" ? "low" : "medium";

  const attempt = async (schema: object, prompt: string, label: string) => {
    let response: Awaited<ReturnType<typeof client.responses.create>>;
    try {
      response = await client.responses.create({
      model: model.model,
      input: [{ role: "user", content: [...content, { type: "input_text", text: prompt }] as never }],
      reasoning: { effort },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: `gnahatum_${call.pass}`,
          strict: true,
          schema: toOpenAIStrictSchema(schema),
        },
      },
    });
    } catch (err) {
      // The SDK's message is good ("429 You have no credits remaining…") but
      // says nothing about which pass or model; scans.error_text needs both.
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI API error in the ${call.pass} pass (${model.name}, ${label}): ${detail}`);
    }
    // create() is typed as Response | Stream; nothing here streams, and the
    // `in` check is what narrows the union for the reads below.
    if (!("output_text" in response)) {
      throw new Error(`OpenAI returned a stream where a response was expected (${call.pass} pass).`);
    }
    const message = response.output.find((item) => item.type === "message");
    const first = message?.type === "message" ? message.content[0] : undefined;
    const refusal = first?.type === "refusal" ? first.refusal : null;
    const text = response.output_text ?? "";
    const usage = response.usage;
    const where =
      `${model.name}, ${call.pass} pass (${label}), reasoning=${effort}` +
      ` — status=${response.status ?? "?"}` +
      (response.incomplete_details?.reason ? `, incomplete=${response.incomplete_details.reason}` : "") +
      (refusal ? `, refusal=${JSON.stringify(refusal.slice(0, 120))}` : "") +
      `, tokens: reasoning=${usage?.output_tokens_details?.reasoning_tokens ?? "?"} output=${usage?.output_tokens ?? "?"}`;

    return { text, raw: response, refusal, incomplete: response.status === "incomplete", where };
  };

  let result = await attempt(call.schema, call.prompt, "full schema");

  // Same recovery as Gemini: a runaway or empty answer gets one retry, on
  // the numbers-only schema when the pass declares one.
  if ((result.incomplete || !result.text) && !result.refusal) {
    console.warn(
      `[gnahatum/openai] retrying (${call.fallback ? "minimal schema" : "same schema"}): ${result.where}` +
        ` — tail of output: ${JSON.stringify(result.text.slice(-400))}`,
    );
    result = call.fallback
      ? await attempt(call.fallback.schema, call.prompt + call.fallback.promptSuffix, "minimal schema")
      : await attempt(call.schema, call.prompt, "same schema");
  }

  if (result.refusal) {
    throw new Error(`${model.name} refused the ${call.pass} pass (${result.where}).`);
  }
  if (result.incomplete) {
    const tail = result.text ? ` Output ended: ${JSON.stringify(result.text.slice(-300))}` : "";
    throw new Error(`OpenAI stopped before finishing (${result.where}).${tail}`);
  }
  if (!result.text) throw new Error(`OpenAI returned no answer text (${result.where}).`);
  return { text: result.text, raw: result.raw };
}
