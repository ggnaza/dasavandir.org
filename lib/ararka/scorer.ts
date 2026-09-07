import { anthropicApiKey, geminiApiKey, PROVIDER_ENV_NAMES } from "@/lib/ai-keys";

import Anthropic from "@anthropic-ai/sdk";
import { POINT_DISTRIBUTION, type AnswerKeyItem, type ScoredItem } from "./constants";
import { getCurrentModel, type ScoringModel } from "./models";

function buildScoringPrompt(answerKey: AnswerKeyItem[], scoringNotes?: string | null): string {
  const keyDescription = answerKey.map((q) => {
    let desc = `Q${q.number} (${q.points} pts, type: ${q.type}): correct answer = ${q.answer}`;
    if (q.sub_parts?.length) {
      desc += `\n  Sub-parts: ${q.sub_parts.map((s) => `${s.label}: ${s.answer} (${s.points} pts)`).join(", ")}`;
    }
    if (q.scoring_notes) {
      desc += `\n  Scoring note: ${q.scoring_notes}`;
    }
    return desc;
  }).join("\n");

  return `You are an expert test grader for Armenian school diagnostic tests.

ANSWER KEY:
${keyDescription}

${scoringNotes ? `GENERAL SCORING NOTES:\n${scoringNotes}\n` : ""}
SCORING RULES:
- Total: 15 points across 15 questions
- Point distribution is FIXED per question number (Q1=0.5, Q2=0.5, Q3=1, Q4=1, Q5=1, Q6=1, Q7=1, Q8=0.5, Q9=0.5, Q10=1, Q11=1, Q12=1, Q13=1.5, Q14=1.5, Q15=2)
- Sub-parts: divide points equally in increments of 0.25 or 0.5
- Spelling errors: mark them but do NOT deduct points (except Russian: -0.1 per error)
- For computation questions: accept correct final answer OR correct method with arithmetic error (partial credit)
- For essay/critical thinking (Q15): score against the rubric criteria, partial credit in 0.5 increments
- For matching questions: all pairs must be correct for full credit; each wrong pair loses proportional points
- If a question is left blank, award 0 points
- If the answer is illegible, note it and award 0 points

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
3. Award points according to the rules
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
      "explanation": "brief note if needed"
    }
  ]
}

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text response from Gemini");
  return { text, raw: data };
}

export async function scoreFromScan(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
  answerKey: AnswerKeyItem[],
  scoringNotes?: string | null,
  modelOverride?: string,
): Promise<ScoringResult> {
  const model = modelOverride
    ? (await import("./models")).SCORING_MODELS.find((m) => m.id === modelOverride) ?? getCurrentModel()
    : getCurrentModel();

  const prompt = buildScoringPrompt(answerKey, scoringNotes);

  let result: { text: string; raw: unknown };
  if (model.provider === "anthropic") {
    result = await scoreWithAnthropic(imageBase64, mediaType, prompt, model);
  } else if (model.provider === "google") {
    result = await scoreWithGemini(imageBase64, mediaType, prompt, model);
  } else {
    throw new Error(`Unsupported provider: ${model.provider}`);
  }

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse scoring response as JSON");

  const parsed = JSON.parse(jsonMatch[0]) as {
    student_name?: string | null;
    teacher_name?: string | null;
    items: ScoredItem[];
  };

  const rawItems = parsed.items ?? [];

  const items: ScoredItem[] = rawItems.map((item) => {
    const maxPts = POINT_DISTRIBUTION[item.number] ?? 0;
    return {
      ...item,
      max_points: maxPts,
      awarded_points: Math.min(item.awarded_points, maxPts),
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
