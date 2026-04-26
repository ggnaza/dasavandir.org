import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = createClient();

  const [
    { count: courseCount },
    { count: learnerCount },
    { count: lessonCount },
  ] = await Promise.all([
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "learner"),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Courses", value: courseCount ?? 0, href: "/admin/courses" },
    { label: "Learners", value: learnerCount ?? 0, href: "#" },
    { label: "Lessons", value: lessonCount ?? 0, href: "#" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <Link
          href="/admin/courses/new"
          className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium"
        >
          + New Course
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white border rounded-xl p-6 hover:shadow-sm transition"
          >
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* Studio banner */}
      <Link
        href="/admin/studio"
        className="flex items-center gap-4 bg-brand-600 text-white rounded-xl p-5 mb-4 hover:bg-brand-700 transition"
      >
        <span className="text-3xl shrink-0">🎛️</span>
        <div>
          <p className="font-semibold">Creation Studio</p>
          <p className="text-brand-100 text-sm">AI builder · Manual courses · Audio narration · Drive import</p>
        </div>
        <span className="ml-auto text-brand-200 text-lg">→</span>
      </Link>

      <div className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold mb-2">Quick links</h2>
        <ul className="space-y-2 text-sm text-brand-600">
          <li><Link href="/admin/courses" className="hover:underline">→ Manage courses</Link></li>
          <li><Link href="/admin/users" className="hover:underline">→ Manage users & roles</Link></li>
          <li><Link href="/admin/analytics" className="hover:underline">→ View analytics</Link></li>
        </ul>
      </div>
    </div>
  );
}
