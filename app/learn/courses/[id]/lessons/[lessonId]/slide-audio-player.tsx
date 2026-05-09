"use client";
import { useEffect, useRef, useState } from "react";

export function SlideAudioPlayer({ urls }: { urls: string[] }) {
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset and play when slide changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.load();
  }, [current]);

  const total = urls.length;
  const url = urls[current];

  function prev() {
    setCurrent((c) => Math.max(0, c - 1));
  }

  function next() {
    setCurrent((c) => Math.min(total - 1, c + 1));
  }

  return (
    <div className="bg-white border rounded-xl px-5 py-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl shrink-0">🎧</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500">Slide-by-slide audio</p>
          <p className="text-xs text-gray-400">Navigate to the matching slide in the presentation above</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={prev}
          disabled={current === 0}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <span className="flex-1 text-center text-sm font-medium text-gray-700">
          Slide {current + 1} <span className="text-gray-400 font-normal">of {total}</span>
        </span>
        <button
          onClick={next}
          disabled={current === total - 1}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>

      {url ? (
        <audio key={current} ref={audioRef} controls autoPlay className="w-full h-9" src={url} />
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">No audio for this slide</p>
      )}
    </div>
  );
}
