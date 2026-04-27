"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Course = { id: string; title: string };
type Learner = {
  id: string;
  full_name: string;
  email: string;
  joined: string;
  last_login: string | null;
  courses: Course[];
  lessons_completed: number;
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function LearnersPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/learners")
      .then((r) => r.json())
      .then((d) => setLearners(d.learners ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = learners.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.full_name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.courses.some((c) => c.title.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Learners</h1>
        <span className="text-sm text-gray-500">{learners.length} total</span>
      </div>

      <input
        type="text"
        placeholder="Search by name, email or course…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No learners found.</div>
      ) : (
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-700">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-700">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-700">Enrolled courses</th>
                <th className="text-left px-5 py-3 font-medium text-gray-700 text-center">Lessons done</th>
                <th className="text-left px-5 py-3 font-medium text-gray-700">Last login</th>
                <th className="text-left px-5 py-3 font-medium text-gray-700">Joined</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium whitespace-nowrap">{l.full_name || "—"}</td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{l.email || "—"}</td>
                  <td className="px-5 py-3">
                    {l.courses.length === 0 ? (
                      <span className="text-gray-400">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {l.courses.map((c) => (
                          <span key={c.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                            {c.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">{l.lessons_completed}</td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{timeAgo(l.last_login)}</td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{new Date(l.joined).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/users/${l.id}/activity`} className="text-brand-600 hover:underline text-xs whitespace-nowrap">
                      Activity →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
