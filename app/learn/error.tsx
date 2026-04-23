"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function LearnError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">Page error</h2>
      <p className="text-gray-500 text-sm mb-4">{error.message}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={reset} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-brand-700">
          Try again
        </button>
        <Link href="/learn" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          My Courses
        </Link>
      </div>
    </div>
  );
}
