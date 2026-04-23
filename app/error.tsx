"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-4">{error.message}</p>
        <button onClick={reset} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700">
          Try again
        </button>
      </div>
    </div>
  );
}
