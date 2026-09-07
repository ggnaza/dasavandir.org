export const POINT_DISTRIBUTION: Record<number, number> = {
  1: 0.5,
  2: 0.5,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
  7: 1,
  8: 0.5,
  9: 0.5,
  10: 1,
  11: 1,
  12: 1,
  13: 1.5,
  14: 1.5,
  15: 2,
};

export const TOTAL_QUESTIONS = 15;
export const TOTAL_POINTS = 15;

export const COGNITIVE_LEVELS = {
  knowledge: { label_hy: "Գիտելիք", label_en: "Knowledge", questions: [1, 2, 3, 4, 5, 6, 7], points: 6 },
  application: { label_hy: "Կիրառություն", label_en: "Application", questions: [8, 9, 10, 11, 12, 13, 14], points: 7 },
  critical: { label_hy: "Քննական մտածողություն", label_en: "Critical Thinking", questions: [15], points: 2 },
} as const;

export type QuestionType =
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "short_answer"
  | "computation"
  | "essay"
  | "table"
  | "diagram"
  | "true_false";

export interface AnswerKeyItem {
  number: number;
  points: number;
  type: QuestionType;
  answer: string;
  sub_parts?: { label: string; answer: string; points: number }[] | null;
  scoring_notes?: string | null;
}

export interface ScoredItem {
  number: number;
  max_points: number;
  awarded_points: number;
  extracted_answer: string;
  correct_answer: string;
  is_correct: boolean;
  confidence: number;
  explanation?: string;
}
