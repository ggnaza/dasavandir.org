"use client";

interface StepperProps {
  steps: string[];
  current: number;
  onSelect: (i: number) => void;
}

export function Stepper({ steps, current, onSelect }: StepperProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-orange-100 text-orange-800 border border-orange-300"
                : isDone
                  ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                  : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive
                  ? "bg-orange-500 text-white"
                  : isDone
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
