"use client";
import { useEffect } from "react";

// Sends a lightweight presence heartbeat while the tab is visible, so staff
// (and learners) show as "online now" in the admin lists. Mounted in the app
// layouts. Silent — failures are ignored.
export function PresencePing() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presence", { method: "POST", cache: "no-store", keepalive: true }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
