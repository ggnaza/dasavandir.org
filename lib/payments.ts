// Payment provider selection.
//
// The FLOW is provider-agnostic: create an order → send the user to a checkout step → on success mark
// the order paid and enrol. Only the "how the money moves" step differs per provider. Choose it with the
// `PAYMENTS_MODE` environment variable:
//
//   - "disabled" (DEFAULT) — payments are OFF. The enrol button on a paid course shows "not available
//     yet" and no order is created. This is the SAFE default, so PRODUCTION never grants paid access
//     until a real gateway is deliberately wired. Leave it unset on prod until then.
//   - "mock" — the built-in TEST flow: the checkout page shows a "Pay (test)" button that marks the order
//     paid and enrols, with no real charge. For STAGING only — NEVER set PAYMENTS_MODE=mock on production.
//   - "arca" / "stripe" (FUTURE) — a real gateway. Implement the seam described below, then the checkout
//     redirects to the gateway and /api/payments/callback verifies + enrols. The order/enrol plumbing
//     (app/api/payments/*, app/checkout/*) is unchanged.
//
// FUTURE gateway seam to implement per provider:
//   createCheckout(order, course, returnUrl): Promise<{ redirectUrl: string; providerRef: string }>
//     — initiate a payment with the gateway, persist providerRef on the order, return its hosted URL.
//   verifyCallback(req): Promise<{ orderId: string; paid: boolean; providerRef: string }>
//     — called by /api/payments/callback when the gateway redirects/pings back; verify the signature,
//       then the route marks the order paid and calls enrollUserInCourse().

export type PaymentMode = "disabled" | "mock" | "arca" | "stripe";

export function paymentMode(): PaymentMode {
  const m = (process.env.PAYMENTS_MODE ?? "disabled").toLowerCase();
  return (["disabled", "mock", "arca", "stripe"].includes(m) ? m : "disabled") as PaymentMode;
}

/** True when a paid course can begin checkout (any provider other than "disabled"). */
export function paymentsAvailable(): boolean {
  return paymentMode() !== "disabled";
}
