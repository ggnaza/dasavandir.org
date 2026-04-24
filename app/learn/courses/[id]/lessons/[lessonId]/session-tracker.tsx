"use client";
import { useEffect } from "react";

export function SessionTracker({ lessonId, userId }: { lessonId: string; userId: string }) {
  useEffect(() => {
    const start = Date.now();

    const send = () => {
      const duration = Math.round((Date.now() - start) / 1000);
      if (duration < 5) return;
      navigator.sendBeacon(
        "/api/lessons/session",
        JSON.stringify({ lessonId, userId, duration })
      );
    };

    window.addEventListener("beforeunload", send);
    return () => {
      window.removeEventListener("beforeunload", send);
      send();
    };
  }, [lessonId, userId]);

  return null;
}
