"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  discussionId: string;
  courseId: string;
  label: string;
  endpoint: string;
  redirectTo: string;
}

export function DeleteButton({ endpoint, redirectTo, label }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    await fetch(endpoint, { method: "DELETE" });
    router.push(redirectTo);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {loading ? "Deleting..." : "Confirm"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-gray-400 hover:text-red-500 shrink-0"
    >
      {label}
    </button>
  );
}
