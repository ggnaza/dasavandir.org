"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordStrength, isPasswordValid } from "@/components/password-strength";
import { safeNextPath } from "@/lib/attestation-invite-email";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  // Invitees created from an email list have no name yet; ask for it once here.
  const [needsName, setNeedsName] = useState(false);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Invalid or expired invitation link.");
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error }) => {
        if (error) {
          setError("Invalid or expired invitation link.");
          return;
        }
        const meta = (data.user?.user_metadata ?? {}) as { full_name?: string; name?: string };
        setNeedsName(!(meta.full_name || meta.name));
        setReady(true);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordValid(password)) {
      setError("Password does not meet the requirements below.");
      return;
    }
    if (needsName && !fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser(
      needsName ? { password, data: { full_name: fullName.trim() } } : { password },
    );
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Marks the account active (otherwise the 24h unverified-account cleanup deletes it).
    const activated = await fetch("/api/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(needsName ? { full_name: fullName.trim() } : {}),
    });
    if (!activated.ok) {
      setError("Your password is set, but the account could not be activated. Please contact support.");
      setLoading(false);
      return;
    }
    // Invitations say where to land, e.g. an attestation invite goes straight to the tests.
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    router.push(next ?? "/learn");
  }

  if (error && !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/auth/login" className="text-sm text-gray-600 hover:underline">Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">Set your password</h1>
        <p className="text-sm text-gray-500 text-center mb-8">Choose a password to activate your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {needsName && (
            <input
              type="text"
              placeholder="Full name (Անուն Ազգանուն)"
              aria-label="Full name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <PasswordStrength password={password} />
          </div>
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full text-white py-2 rounded-lg disabled:opacity-50 font-medium"
            style={{ backgroundColor: "#EC5328" }}
          >
            {loading ? "Activating…" : "Activate account"}
          </button>
        </form>
      </div>
    </div>
  );
}
