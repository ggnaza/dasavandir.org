"use client";
import { useEffect } from "react";
import { MAX_SESSION_ROW_SECONDS } from "@/lib/session-time";

// Records only ACTIVE time on a lesson:
//  - counts wall-clock only while the tab is visible (background/duplicate tabs
//    don't accrue, so multiple open tabs no longer multiply the total),
//  - ignores large gaps (tab throttled or machine asleep),
//  - pauses after a stretch of no interaction (abandoned foreground tab),
//  - reports accumulated active time in small chunks (heartbeat + on leave).
const IDLE_MS = 5 * 60_000;   // stop counting after 5 min with no interaction
const MAX_GAP_MS = 20_000;    // ignore jumps > 20s (tab was throttled/asleep)
const FLUSH_MS = 30_000;      // report accumulated active time every 30s
const MIN_REPORT_SECONDS = 5;

export function SessionTracker({ lessonId, userId }: { lessonId: string; userId: string }) {
  useEffect(() => {
    let activeMs = 0;
    let lastTick = Date.now();
    let lastActivity = Date.now();

    const measure = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;
      if (
        document.visibilityState === "visible" &&
        delta <= MAX_GAP_MS &&
        now - lastActivity < IDLE_MS
      ) {
        activeMs += delta;
      }
    };

    const flush = (useBeacon = false) => {
      measure();
      let seconds = Math.floor(activeMs / 1000);
      if (seconds < MIN_REPORT_SECONDS) return;
      seconds = Math.min(seconds, MAX_SESSION_ROW_SECONDS);
      activeMs -= seconds * 1000;
      const payload = JSON.stringify({ lessonId, userId, duration: seconds });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/lessons/session", payload);
      } else {
        fetch("/api/lessons/session", { method: "POST", body: payload, keepalive: true }).catch(() => {});
      }
    };

    const onActivity = () => { lastActivity = Date.now(); };
    const onVisibility = () => {
      measure();
      if (document.visibilityState === "hidden") {
        flush(true);
      } else {
        // Coming back into view — don't count the time spent hidden.
        lastTick = Date.now();
        lastActivity = Date.now();
      }
    };
    const onBeforeUnload = () => flush(true);

    const events: (keyof WindowEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    const measureTimer = setInterval(measure, 5_000);
    const flushTimer = setInterval(() => flush(false), FLUSH_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearInterval(measureTimer);
      clearInterval(flushTimer);
      flush(true);
    };
  }, [lessonId, userId]);

  return null;
}
