import { redirect, notFound } from "next/navigation";
import { checkCourseAccess } from "@/lib/assert-course-owner";

/**
 * Page-level course-access guard for Server Component pages under
 * /admin/courses/[id]/*.
 *
 * Unlike assertCourseOwner (which returns a Response for API routes), this
 * performs Next.js navigation. A Server Component page MUST return renderable
 * React — returning a Response object crashes the render ("An error occurred in
 * the Server Components render"), which is exactly what a denied course_manager
 * used to hit. A missing course is a 404; a forbidden user is sent back to their
 * course list rather than shown a crash.
 *
 * Both redirect() and notFound() throw internally, so this never returns on the
 * denied paths.
 */
export async function assertCoursePageAccess(courseId: string, userId: string): Promise<void> {
  const access = await checkCourseAccess(courseId, userId);
  if (access === "not_found") notFound();
  if (access === "forbidden") redirect("/admin/courses");
}
