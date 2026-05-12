"use client";
import { useState } from "react";

export function ResendActivationButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleResend() {
    setState("sending");
    try {
      const res = await fetch("/api/auth/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") return <span className="font-medium text-amber-900">Email sent!</span>;
  if (state === "error") return <span className="text-red-700">Failed to send — try again later.</span>;

  return (
    <button
      onClick={handleResend}
      disabled={state === "sending"}
      className="underline font-medium hover:text-amber-900 disabled:opacity-50"
    >
      {state === "sending" ? "Sending…" : "Resend email"}
    </button>
  );
}
