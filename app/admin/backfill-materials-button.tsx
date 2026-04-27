"use client";
import { useState } from "react";

export function BackfillMaterialsButton() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setRunning(true);
    setDone(false);
    setError("");
    const res = await fetch("/api/admin/backfill-materials", { method: "POST" });
    if (res.ok) {
      setDone(true);
    } else {
      setError("Failed — make sure you are connected to Google Drive first.");
    }
    setRunning(false);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {running ? "Extracting all materials…" : "Sync all lesson materials for AI"}
      </button>
      {done && <span className="text-xs text-green-600">Done — AI coach updated</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
