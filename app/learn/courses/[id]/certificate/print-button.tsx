"use client";
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-medium"
    >
      Print / Save PDF
    </button>
  );
}
