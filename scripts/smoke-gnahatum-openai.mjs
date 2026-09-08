#!/usr/bin/env node
/**
 * Hands-on smoke test of the OpenAI scoring path — the REAL prompts, schemas
 * and provider module, on a REAL scan pulled from storage. Nothing mocked.
 *
 * The Gemini and Anthropic paths cannot be exercised from a dev machine
 * (OQ-020); this is the one provider that can, so it is the scorer's only
 * end-to-end acceptance. Run it after any change to prompts.ts, openai.ts or
 * the schemas, and after adding an OpenAI model id.
 *
 *   set -a; source .env.local; set +a
 *   node scripts/smoke-gnahatum-openai.mjs [model-id] [scan-uuid-suffix]
 *
 * Needs OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Spends real money: one transcription + one grading call.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { buildTranscriptionPrompt, buildGradingPrompt, TRANSCRIPTION_SCHEMA, GRADING_SCHEMA,
        GRADING_SCHEMA_MINIMAL, GRADING_FALLBACK_SUFFIX } = await import(join(root, "lib/gnahatum/prompts.ts"));
const { callOpenAI, toOpenAIStrictSchema } = await import(join(root, "lib/gnahatum/openai.ts"));

const modelId = process.argv[2] ?? "gpt-5.6-terra";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const key = process.env.OPENAI_API_KEY;
if (!url || !svc || !key) { console.error("missing env — see header"); process.exit(2); }
const h = { apikey: svc, Authorization: `Bearer ${svc}`, "Accept-Profile": "ararka" };

const [scan] = await (await fetch(`${url}/rest/v1/scans?select=file_path,test_id&status=eq.scored&order=created_at.desc&limit=1`, { headers: h })).json();
const [test] = await (await fetch(`${url}/rest/v1/tests?select=subject_id,grade,answer_key,scoring_notes&id=eq.${scan.test_id}`, { headers: h })).json();
const pdf = Buffer.from(await (await fetch(`${url}/storage/v1/object/ararka-scans/${scan.file_path}`, { headers: h })).arrayBuffer());
console.log(`scan …${scan.file_path.slice(-12)} (${(pdf.length/1024).toFixed(0)} KB) · ${test.subject_id} grade ${test.grade} · ${test.answer_key.length} key items · model ${modelId}`);

const model = { id: modelId, name: modelId, provider: "openai", model: modelId, description: "" };
const strict = toOpenAIStrictSchema(GRADING_SCHEMA);
console.log(`strict schema ok: additionalProperties=${strict.additionalProperties} required=${JSON.stringify(strict.required)}`);

let t0 = Date.now();
const p1 = await callOpenAI({ pass: "transcription", prompt: buildTranscriptionPrompt(test.answer_key),
  scan: { base64: pdf.toString("base64"), mediaType: "application/pdf" }, schema: TRANSCRIPTION_SCHEMA }, model, key);
const tr = JSON.parse(p1.text); const u1 = p1.raw.usage;
console.log(`\nPASS 1 ok ${((Date.now()-t0)/1000).toFixed(0)}s — answers=${tr.answers.length} name-read=${!!tr.student_name} tokens in=${u1.input_tokens} out=${u1.output_tokens} reasoning=${u1.output_tokens_details?.reasoning_tokens}`);
for (const a of tr.answers.slice(0, 3)) console.log(`  Q${a.number} legibility=${a.legibility}: ${JSON.stringify(String(a.student_answer).slice(0, 80))}`);

t0 = Date.now();
const transcript = test.answer_key.map((q) => { const a = tr.answers.find((x) => x.number === q.number);
  return { number: q.number, student_answer: a?.student_answer ?? "[illegible]", legibility: a?.legibility ?? 0 }; });
const p2 = await callOpenAI({ pass: "grading", prompt: buildGradingPrompt(test.answer_key, transcript, test.scoring_notes),
  schema: GRADING_SCHEMA, fallback: { schema: GRADING_SCHEMA_MINIMAL, promptSuffix: GRADING_FALLBACK_SUFFIX } }, model, key);
const gr = JSON.parse(p2.text); const u2 = p2.raw.usage;
const maxBy = Object.fromEntries(test.answer_key.map((q) => [q.number, q.points]));
const total = gr.items.reduce((s, i) => s + i.awarded_points, 0);
const bad = gr.items.filter((i) => i.awarded_points > maxBy[i.number] || Math.abs(i.awarded_points*4 - Math.round(i.awarded_points*4)) > 1e-9);
console.log(`\nPASS 2 ok ${((Date.now()-t0)/1000).toFixed(0)}s — items=${gr.items.length} total=${total}/15 invalid-awards=${bad.length} tokens in=${u2.input_tokens} out=${u2.output_tokens} reasoning=${u2.output_tokens_details?.reasoning_tokens}`);
for (const i of gr.items) console.log(`  Q${String(i.number).padStart(2)} ${String(i.awarded_points).padStart(4)}/${maxBy[i.number]}  ${i.points_breakdown ?? ""}`);
if (gr.items.length !== test.answer_key.length || bad.length) { console.error("\nFAIL: wrong item count or invalid award"); process.exit(1); }
console.log("\nOK");
