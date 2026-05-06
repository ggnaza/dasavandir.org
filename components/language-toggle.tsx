"use client";

import type { Lang } from "@/lib/i18n";

export function LanguageToggle({ current }: { current: Lang }) {
  async function switchTo(lang: Lang) {
    await fetch("/api/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang }),
    });
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-1 text-sm border rounded-lg overflow-hidden">
      <button
        onClick={() => switchTo("en")}
        className={`px-2.5 py-1 font-medium transition ${
          current === "en" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => switchTo("hy")}
        className={`px-2.5 py-1 font-medium transition ${
          current === "hy" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
        }`}
      >
        ՀՅ
      </button>
    </div>
  );
}
