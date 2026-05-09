"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "resend">("login");
  const [successMsg, setSuccessMsg] = useState("");
  const supabase = createClient();

  // Show activation success banner if redirected from activation link
  const activated = searchParams.get("activated");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      setError(text);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/set-password`,
    });

    if (err) {
      setError(err.message);
    } else {
      setSuccessMsg("If that email is registered, a password reset link has been sent.");
    }
    setLoading(false);
  }

  async function handleResendActivation(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    setError("");
    setSuccessMsg("");

    await fetch("/api/auth/resend-activation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setSuccessMsg("If there is a pending account with that email, a new activation link has been sent.");
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {activated && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 text-center">
            Account activated! You can now sign in.
          </div>
        )}

        {mode === "login" && (
          <>
            <h1 className="text-2xl font-bold text-center mb-8">Sign in</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); setSuccessMsg(""); }}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex-1 border-t"></div>
              <span className="text-sm text-gray-500">or</span>
              <div className="flex-1 border-t"></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full mt-4 border border-gray-300 bg-white text-gray-700 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {loading ? "Signing in…" : "Sign in with Google"}
            </button>

            <div className="text-center mt-4 space-y-1">
              <p className="text-sm text-gray-600">
                No account?{" "}
                <Link href="/auth/signup" className="text-brand-600 hover:underline">Sign up</Link>
              </p>
              <p className="text-sm text-gray-500">
                Didn't receive your activation email?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("resend"); setError(""); setSuccessMsg(""); }}
                  className="text-brand-600 hover:underline"
                >
                  Resend it
                </button>
              </p>
            </div>
          </>
        )}

        {mode === "forgot" && (
          <>
            <h1 className="text-2xl font-bold text-center mb-2">Reset password</h1>
            <p className="text-sm text-gray-500 text-center mb-6">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              {successMsg && <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded p-3">{successMsg}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
              className="mt-4 text-sm text-gray-500 hover:underline block text-center w-full"
            >
              ← Back to sign in
            </button>
          </>
        )}

        {mode === "resend" && (
          <>
            <h1 className="text-2xl font-bold text-center mb-2">Resend activation</h1>
            <p className="text-sm text-gray-500 text-center mb-6">Enter your email and we'll resend the activation link.</p>
            <form onSubmit={handleResendActivation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              {successMsg && <p className="text-green-700 text-sm bg-green-50 border border-green-200 rounded p-3">{successMsg}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-600 text-white py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
              >
                {loading ? "Sending…" : "Resend activation email"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
              className="mt-4 text-sm text-gray-500 hover:underline block text-center w-full"
            >
              ← Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
