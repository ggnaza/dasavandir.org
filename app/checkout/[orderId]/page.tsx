import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { paymentMode } from "@/lib/payments";
import { CheckoutClient } from "./checkout-client";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: { orderId: string } }) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect(`/auth/login?next=/checkout/${params.orderId}`);

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("course_orders")
    .select("id, user_id, course_id, amount_amd, status, courses(title, cover_image_url)")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order || order.user_id !== user.id) notFound();

  // Already paid → straight to the course.
  if (order.status === "paid") redirect(`/learn/courses/${order.course_id}`);

  const course = (order as unknown as { courses: { title?: string; cover_image_url?: string | null } | null }).courses;

  return (
    <CheckoutClient
      orderId={order.id}
      courseId={order.course_id}
      courseTitle={course?.title ?? "Course"}
      cover={course?.cover_image_url ?? null}
      amount={order.amount_amd}
      mode={paymentMode()}
    />
  );
}
