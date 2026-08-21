import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { getCurrentOrgId } from "@/lib/org";
import { paymentMode, paymentsAvailable } from "@/lib/payments";
import { z } from "zod";

const schema = z.object({ courseId: z.string().uuid() });

// POST /api/payments/checkout — start a single-course purchase. Creates a pending order and returns the
// URL to send the buyer to. In "mock" mode that's our own /checkout/[orderId]; a real gateway would
// return its hosted checkout URL (see lib/payments seam).
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Please sign in to enrol." }), { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
  const { courseId } = parsed.data;

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, is_paid, price_amd, access_type, org_id")
    .eq("id", courseId)
    .eq("published", true)
    .maybeSingle();
  if (!course) return new Response(JSON.stringify({ error: "Course not found" }), { status: 404 });
  if (course.access_type === "private") {
    return new Response(JSON.stringify({ error: "This course is invitation-only." }), { status: 403 });
  }
  if (!course.is_paid) {
    return new Response(JSON.stringify({ error: "This is a free course — enrol directly." }), { status: 400 });
  }

  // Already enrolled → no payment needed.
  const { data: existing } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existing) return Response.json({ alreadyEnrolled: true, courseId });

  if (!paymentsAvailable()) {
    return new Response(
      JSON.stringify({ error: "Payments are not available yet. Please check back soon." }),
      { status: 503 }
    );
  }

  await ensureProfile(admin, user);
  const orgId = course.org_id ?? (await getCurrentOrgId(admin));

  const { data: order, error } = await admin
    .from("course_orders")
    .insert({
      user_id: user.id,
      course_id: courseId,
      org_id: orgId,
      amount_amd: course.price_amd ?? 0,
      status: "pending",
      provider: paymentMode(),
    })
    .select("id")
    .single();
  if (error || !order) {
    return new Response(JSON.stringify({ error: error?.message ?? "Could not start checkout" }), { status: 500 });
  }

  // mock → our own checkout page. Real gateway → initiate + return its hosted URL (lib/payments seam).
  return Response.json({ checkoutUrl: `/checkout/${order.id}` });
}
