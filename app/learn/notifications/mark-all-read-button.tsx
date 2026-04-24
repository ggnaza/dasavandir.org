"use client";
import { useRouter } from "next/navigation";

export function MarkAllReadButton() {
  const router = useRouter();

  async function handleClick() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      className="text-sm text-gray-400 hover:text-gray-600"
    >
      Mark all read
    </button>
  );
}
