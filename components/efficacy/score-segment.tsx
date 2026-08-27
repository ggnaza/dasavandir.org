"use client";

interface ScoreSegmentProps {
  value: number | null;
  onChange: (v: number | null) => void;
  readOnly?: boolean;
}

function scoreColor(v: number): string {
  if (v >= 4) return "bg-green-500 text-white";
  if (v >= 2.5) return "bg-yellow-400 text-gray-900";
  return "bg-red-500 text-white";
}

export function scoreColorClass(v: number | null): string {
  if (v === null || v === undefined) return "text-gray-400";
  if (v >= 4) return "text-green-600";
  if (v >= 2.5) return "text-yellow-600";
  return "text-red-600";
}

export function ScoreSegment({ value, onChange, readOnly }: ScoreSegmentProps) {
  const options = [0, 1, 2, 3, 4, 5];

  if (readOnly) {
    return (
      <span className={`font-semibold ${scoreColorClass(value)}`}>
        {value !== null && value !== undefined ? value : "-"}
      </span>
    );
  }

  return (
    <div className="flex gap-0.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${
          value === null || value === undefined
            ? "bg-gray-200 border-gray-300 text-gray-700"
            : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"
        }`}
      >
        -
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${
            value === opt
              ? `${scoreColor(opt)} border-transparent`
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function ScoreBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
  const rounded = Math.round(value * 100) / 100;
  return <span className={`font-semibold ${scoreColorClass(value)}`}>{rounded}</span>;
}
