import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

function PriceBadge({ isPaid, priceAmd }: { isPaid: boolean; priceAmd: number | null }) {
  if (!isPaid) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        Free
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
      {priceAmd ? `${priceAmd.toLocaleString()} AMD` : "Paid"}
    </span>
  );
}

export default async function CourseCatalogPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const admin = createAdminClient();
  const { data: courses } = await admin
    .from("courses")
    .select("id, title, description, cover_image_url, is_paid, price_amd")
    .eq("published", true)
    .order("created_at", { ascending: false });

  const filter = searchParams.filter ?? "all";
  const filtered = (courses ?? []).filter((c) => {
    if (filter === "free") return !c.is_paid;
    if (filter === "paid") return c.is_paid;
    return true;
  });

  const tabs = [
    { key: "all", label: "All" },
    { key: "free", label: "Free" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-1">
            <Link href="/" className="text-2xl font-bold" style={{ color: "#EC5328" }}>
              Dasavandir
            </Link>
            <div className="flex gap-3 text-sm">
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
              <Link href="/auth/signup" className="text-white px-4 py-1.5 rounded-lg font-medium" style={{ backgroundColor: "#EC5328" }}>
                Get started
              </Link>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-1">Browse Courses</h1>
          <p className="text-gray-500 text-sm">Explore courses built by educators at Teach For Armenia.</p>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-5">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={`/courses?filter=${tab.key}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  filter === tab.key
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                style={filter === tab.key ? { backgroundColor: "#EC5328" } : {}}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Course grid */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        {filtered.length === 0 ? (
          <p className="text-gray-500">No courses found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="bg-white border rounded-2xl overflow-hidden hover:shadow-md transition flex flex-col"
              >
                {/* Cover image */}
                {course.cover_image_url ? (
                  <img
                    src={course.cover_image_url}
                    alt={course.title}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center text-4xl" style={{ backgroundColor: "#323131" }}>
                    🎓
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="font-bold text-gray-900 leading-snug">{course.title}</h2>
                    <PriceBadge isPaid={!!course.is_paid} priceAmd={course.price_amd} />
                  </div>
                  {course.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 flex-1">{course.description}</p>
                  )}
                  <p className="text-sm font-medium mt-4" style={{ color: "#EC5328" }}>
                    View course →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
