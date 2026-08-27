"use client";
import { ScoreSegment, ScoreBadge } from "./score-segment";

interface FlatRow {
  key: string;
  label: string;
  score: number | null;
  comment: string;
}

export interface FlatRubricData {
  rows: FlatRow[];
  overallAverage: number | null;
  generalComment: string;
}

interface FlatRubricEditorProps {
  title?: string;
  value: FlatRubricData;
  onChange: (v: FlatRubricData) => void;
  readOnly?: boolean;
}

function recomputeAverage(rows: FlatRow[]): number | null {
  const scored = rows.filter((r) => r.score !== null);
  return scored.length > 0
    ? Math.round((scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) * 100) / 100
    : null;
}

export function emptyFlatRubric(criteria: readonly { key: string; label: string }[]): FlatRubricData {
  return {
    rows: criteria.map((c) => ({ key: c.key, label: c.label, score: null, comment: "" })),
    overallAverage: null,
    generalComment: "",
  };
}

export function FlatRubricEditor({ title, value, onChange, readOnly }: FlatRubricEditorProps) {
  function updateRow(idx: number, patch: Partial<FlatRow>) {
    const rows = value.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange({ ...value, rows, overallAverage: recomputeAverage(rows) });
  }

  return (
    <div className="space-y-4">
      {title && <h3 className="font-semibold text-gray-900">{title}</h3>}

      <div className="bg-white rounded-lg border p-4 space-y-4">
        {value.rows.map((row, idx) => (
          <div key={row.key} className="border-l-2 border-gray-100 pl-3">
            <p className="text-sm text-gray-700 mb-2">{row.label}</p>
            <ScoreSegment
              value={row.score}
              onChange={(s) => updateRow(idx, { score: s })}
              readOnly={readOnly}
            />
            {!readOnly && (
              <textarea
                value={row.comment}
                onChange={(e) => updateRow(idx, { comment: e.target.value })}
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

        {!readOnly && (
          <textarea
            value={value.generalComment}
            onChange={(e) => onChange({ ...value, generalComment: e.target.value })}
            placeholder="General comment..."
            rows={2}
            className="w-full px-3 py-2 text-sm border rounded resize-y"
          />
        )}
        {readOnly && value.generalComment && (
          <p className="text-sm text-gray-600 border-t pt-3 italic">{value.generalComment}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 p-3 bg-white rounded-lg border">
        <span className="text-sm font-medium text-gray-700">Average:</span>
        <ScoreBadge value={value.overallAverage} />
      </div>
    </div>
  );
}
