import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CapstoneEditor } from "./capstone-editor";

export default async function AdminCapstonePage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const [{ data: course }, { data: capstone }] = await Promise.all([
    admin.from("courses").select("id, title").eq("id", params.id).single(),
    admin.from("capstones").select("*").eq("course_id", params.id).single(),
  ]);

  if (!course) notFound();

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← {course.title}
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-bold">Capstone Project</h1>
        {capstone && (
          <Link
            href="/admin/capstone-submissions"
            className="text-sm text-brand-600 hover:underline"
          >
            View submissions →
          </Link>
        )}
      </div>

      <CapstoneEditor courseId={params.id} existing={capstone ?? null} />
    </div>
  );
}
