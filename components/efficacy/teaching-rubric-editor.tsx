"use client";
import { TEACHING_RUBRIC_CATEGORIES } from "@/lib/efficacy/rubrics";
import { ScoreSegment, ScoreBadge } from "./score-segment";

interface RubricRow {
  key: string;
  label: string;
  score: number | null;
  comment: string;
}

interface RubricCategory {
  key: string;
  name: string;
  rows: RubricRow[];
  categoryComment: string;
  categoryAverage: number | null;
}

export interface TeachingRubricData {
  headline: { score: number | null; comment: string };
  categories: RubricCategory[];
  overallAverage: number | null;
  summaryComment: string;
}

interface TeachingRubricEditorProps {
  value: TeachingRubricData;
  onChange: (v: TeachingRubricData) => void;
  readOnly?: boolean;
}

function recomputeCategory(cat: RubricCategory): RubricCategory {
  const scored = cat.rows.filter((r) => r.score !== null);
  const avg =
    scored.length > 0
      ? Math.round((scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) * 100) / 100
      : null;
  return { ...cat, categoryAverage: avg };
}

function recomputeOverall(cats: RubricCategory[]): number | null {
  const avgs = cats.map((c) => c.categoryAverage).filter((n): n is number => n !== null);
  return avgs.length > 0
    ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100
    : null;
}

export function emptyTeachingRubric(): TeachingRubricData {
  return {
    headline: { score: null, comment: "" },
    categories: TEACHING_RUBRIC_CATEGORIES.map((cat) => ({
      key: cat.key,
      name: cat.name,
      rows: cat.criteria.map((label, i) => ({
        key: `${cat.key}-${i}`,
        label,
        score: null,
        comment: "",
      })),
      categoryComment: "",
      categoryAverage: null,
    })),
    overallAverage: null,
    summaryComment: "",
  };
}

export function TeachingRubricEditor({ value, onChange, readOnly }: TeachingRubricEditorProps) {
  function updateRow(catIdx: number, rowIdx: number, patch: Partial<RubricRow>) {
    const cats = value.categories.map((cat, ci) => {
      if (ci !== catIdx) return cat;
      const rows = cat.rows.map((r, ri) => (ri === rowIdx ? { ...r, ...patch } : r));
      return recomputeCategory({ ...cat, rows });
    });
    onChange({ ...value, categories: cats, overallAverage: recomputeOverall(cats) });
  }

  function updateCategoryComment(catIdx: number, comment: string) {
    const cats = value.categories.map((cat, ci) =>
      ci === catIdx ? { ...cat, categoryComment: comment } : cat
    );
    onChange({ ...value, categories: cats });
  }

  return (
    <div className="space-y-6">
      {value.categories.map((cat, catIdx) => (
        <div key={cat.key} className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{cat.name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Average:</span>
              <ScoreBadge value={cat.categoryAverage} />
            </div>
          </div>
          <div className="space-y-4">
            {cat.rows.map((row, rowIdx) => (
              <div key={row.key} className="border-l-2 border-gray-100 pl-3">
                <p className="text-sm text-gray-700 mb-2">{row.label}</p>
                <div className="flex items-center gap-3 mb-1">
                  <ScoreSegment
                    value={row.score}
                    onChange={(s) => updateRow(catIdx, rowIdx, { score: s })}
                    readOnly={readOnly}
                  />
                </div>
                {!readOnly && (
                  <textarea
                    value={row.comment}
                    onChange={(e) => updateRow(catIdx, rowIdx, { comment: e.target.value })}
                    placeholder="Comment..."
                    rows={1}
                    className="w-full mt-1 px-2 py-1 text-sm border rounded resize-y"
                  />
                )}
                {readOnly && row.comment && (
                  <p className="text-sm text-gray-600 mt-1 italic">{row.comment}</p>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <textarea
              value={cat.categoryComment}
              onChange={(e) => updateCategoryComment(catIdx, e.target.value)}
              placeholder="Category comment..."
              rows={2}
              className="w-full mt-4 px-3 py-2 text-sm border rounded resize-y"
            />
          )}
          {readOnly && cat.categoryComment && (
            <p className="text-sm text-gray-600 mt-4 border-t pt-3 italic">{cat.categoryComment}</p>
          )}
        </div>
      ))}

      <div className="flex items-center justify-end gap-3 p-3 bg-white rounded-lg border">
        <span className="text-sm font-medium text-gray-700">Overall Average:</span>
        <span className="text-lg">
          <ScoreBadge value={value.overallAverage} />
        </span>
      </div>
    </div>
  );
}
