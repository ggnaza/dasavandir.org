"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function CheckoutClient({
  orderId,
  courseId,
  courseTitle,
  cover,
  amount,
  mode,
}: {
  orderId: string;
  courseId: string;
  courseTitle: string;
  cover: string | null;
  amount: number;
  mode: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/payments/${orderId}/confirm`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Payment failed. Please try again.");
      setLoading(false);
      return;
    }
    // Paid + enrolled — go straight into the course.
    router.push(`/learn/courses/${courseId}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border shadow-sm w-full max-w-md p-8">
        <Link href={`/courses/${courseId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to course
        </Link>
        <h1 className="text-xl font-bold mt-3 mb-1">Checkout</h1>
        <p className="text-sm text-gray-500 mb-6">Complete your enrolment.</p>

        <div className="flex items-center gap-3 border rounded-xl p-4 mb-6">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="w-14 h-14 rounded-lg object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">🎓</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{courseTitle}</p>
            <p className="text-xs text-gray-400">One-time purchase</p>
          </div>
          <p className="font-bold whitespace-nowrap">{amount.toLocaleString()} ֏</p>
        </div>

        {mode === "mock" ? (
          <>
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Test mode — no real payment is taken. This stands in for the payment gateway during setup.
            </div>
            <button
              onClick={pay}
              disabled={loading}
              className="w-full text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
              style={{ backgroundColor: "#EC5328" }}
            >
              {loading ? "Processing…" : `Pay ${amount.toLocaleString()} ֏ (test)`}
            </button>
          </>
        ) : (
          <div className="rounded-lg bg-gray-50 border px-3 py-4 text-sm text-gray-600 text-center">
            The payment gateway is not configured in this environment yet. Please check back soon.
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  );
}
