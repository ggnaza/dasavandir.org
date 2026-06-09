import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResourceLibraryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: course } = await admin.from("courses").select("id, title").eq("id", params.id).single();
  if (!course) notFound();

  const { data: enrollment } = await admin
    .from("enrollments").select("id").eq("user_id", user.id).eq("course_id", params.id).maybeSingle();
  if (!enrollment) redirect(`/courses/${params.id}`);

  const { data: resources } = await admin
    .from("course_resources")
    .select("id, title, url, file_name, description, created_at")
    .eq("course_id", params.id)
    .order("created_at");

  return (
    <div className="max-w-2xl">
      <Link href={`/learn/courses/${params.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← {course.title}
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Resource Library</h1>
      <p className="text-gray-500 text-sm mb-6">
        Rubrics, templates, guides, and reference materials for this course.
      </p>

      {(!resources || resources.length === 0) ? (
        <div className="bg-white border rounded-xl p-10 text-center text-gray-400">
          No resources have been added to this course yet.
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((r) => (
            <a
              key={r.id}
              href={r.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 bg-white border rounded-xl px-5 py-4 hover:border-brand-300 hover:bg-brand-50 transition-colors group"
            >
              <span className="text-2xl mt-0.5">
                {r.file_name?.endsWith(".pdf") ? "📄" : r.url?.includes("docs.google") ? "📝" : r.url?.includes("sheets") ? "📊" : r.url?.includes("slides") ? "🖼" : "🔗"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 group-hover:text-brand-700">{r.title}</p>
                {r.description && <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>}
                {r.file_name && <p className="text-xs text-gray-400 mt-0.5">{r.file_name}</p>}
              </div>
              <span className="text-gray-300 group-hover:text-brand-500 text-sm shrink-0">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
