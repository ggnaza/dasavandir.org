import Anthropic from "@anthropic-ai/sdk";
import { POINT_DISTRIBUTION, type AnswerKeyItem, type ScoredItem } from "./constants";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
Look at the uploaded scan of a filled-in test. For EACH question (1-15):
1. Extract what the student wrote/marked as their answer
2. Compare to the correct answer
3. Award points according to the rules

Respond with ONLY a valid JSON array of 15 objects, one per question:
[
  {
    "number": 1,
    "max_points": 0.5,
    "awarded_points": 0.5,
    "extracted_answer": "what the student wrote",
    "correct_answer": "the correct answer",
    "is_correct": true,
    "confidence": 0.95,
    "explanation": "brief note if needed"
  },
  ...
]

confidence is 0-1 representing how sure you are about reading the student's handwriting.
If you cannot read a question's answer, set confidence to a low value and explain why.`;
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export async function scoreFromScan(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
  answerKey: AnswerKeyItem[],
  scoringNotes?: string | null,
): Promise<{ items: ScoredItem[]; totalScore: number; raw: unknown }> {
  const prompt = buildScoringPrompt(answerKey, scoringNotes);

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
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [contentBlock, { type: "text", text: prompt }],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from scoring model");
  }

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not parse scoring response as JSON array");
  }

  const rawItems = JSON.parse(jsonMatch[0]) as ScoredItem[];

  const items: ScoredItem[] = rawItems.map((item) => {
    const maxPts = POINT_DISTRIBUTION[item.number] ?? 0;
    return {
      ...item,
      max_points: maxPts,
      awarded_points: Math.min(item.awarded_points, maxPts),
    };
  });

  const totalScore = items.reduce((sum, i) => sum + i.awarded_points, 0);

  return { items, totalScore, raw: response };
}
