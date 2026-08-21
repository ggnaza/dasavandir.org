import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { enrollUserInCourse } from "@/lib/enroll";
import { paymentMode } from "@/lib/payments";

// POST /api/payments/[orderId]/confirm — the MOCK gateway's "pay" action: mark the order paid + enrol.
// Valid ONLY in "mock" mode. A real gateway confirms via a signed /api/payments/callback, never this —
// so this can never grant free access on a production environment (where PAYMENTS_MODE is not "mock").
export async function POST(_req: Request, { params }: { params: { orderId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  if (paymentMode() !== "mock") {
    return new Response(JSON.stringify({ error: "Test payments are disabled in this environment." }), { status: 403 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("course_orders")
    .select("id, user_id, course_id, status")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order || order.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
  }

  if (order.status !== "paid") {
    const { error: upErr } = await admin
      .from("course_orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_ref: `mock_${order.id}` })
      .eq("id", order.id);
    if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });
  }

  const { error: enrErr } = await enrollUserInCourse(admin, user.id, order.course_id);
  if (enrErr) return new Response(JSON.stringify({ error: enrErr }), { status: 500 });

  return Response.json({ ok: true, courseId: order.course_id });
}
