import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgId, getManagedSpaceIds } from "@/lib/org";
import Link from "next/link";
import { CoursesBoard, type BoardCourse } from "./courses-board";

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: { space?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "course_manager";
  const isSpaceManager = profile?.role === "space_manager";

  // Spaces a space_manager administers (drives both their course list and their subtabs).
  const managedSpaceIds = isSpaceManager ? await getManagedSpaceIds(admin, user!.id) : [];

  const COLS = "id, title, description, published, created_at, created_by, space_id";
  let courses: any[] = [];

  if (isAdmin) {
    const { data } = await admin
      .from("courses")
      .select(COLS)
      .order("created_at", { ascending: false });
    courses = data ?? [];
  } else if (isSpaceManager) {
    // Space managers see every course in the space(s) they manage.
    const { data } = managedSpaceIds.length
      ? await admin.from("courses").select(COLS).in("space_id", managedSpaceIds).order("created_at", { ascending: false })
      : { data: [] };
    courses = data ?? [];
  } else if (isManager) {
    // course_managers see only courses they're explicitly assigned to via course_manager_access
    const { data } = await admin
      .from("course_manager_access")
      .select(`course_id, courses(${COLS})`)
      .eq("manager_id", user!.id);
    courses = (data ?? []).map((r: any) => r.courses).filter(Boolean);
  } else {
    // Course creators see only courses they're assigned to
    const { data } = await admin
      .from("course_creator_access")
      .select(`course_id, courses(${COLS})`)
      .eq("creator_id", user!.id);
    courses = (data ?? []).map((r: any) => r.courses).filter(Boolean);
  }

  // Spaces for the current org (for the subtabs). Only surface tabs the user actually has courses in,
  // plus every space for an admin (who can file courses anywhere).
  const orgId = await getCurrentOrgId(admin);
  const { data: allSpaces } = orgId
    ? await admin.from("spaces").select("id, name, ord").eq("org_id", orgId).order("ord")
    : { data: [] };
  // A space manager only sees subtabs for the spaces they administer.
  const spaces = (allSpaces ?? []).filter(
    (s) => !isSpaceManager || managedSpaceIds.includes(s.id as string)
  );

  const enrollmentCounts: Record<string, number> = {};
  const creatorNames: Record<string, string> = {};

  if (courses.length) {
    const [{ data: enrollments }, { data: profiles }] = await Promise.all([
      admin.from("enrollments").select("course_id").in("course_id", courses.map((c) => c.id)),
      admin.from("profiles").select("id, full_name").in("id", courses.map((c) => c.created_by).filter(Boolean)),
    ]);
    for (const e of enrollments ?? []) {
      enrollmentCounts[e.course_id] = (enrollmentCounts[e.course_id] ?? 0) + 1;
    }
    for (const p of profiles ?? []) {
      creatorNames[p.id] = p.full_name;
    }
  }

  // course_managers get a read-only list (View cohort), so dragging is disabled for them.
  const canMove = !isManager;

  const boardCourses: BoardCourse[] = courses.map((c) => ({
    id: c.id as string,
    title: c.title as string,
    description: (c.description as string | null) ?? null,
    published: Boolean(c.published),
    space_id: (c.space_id as string | null) ?? null,
    enrolled: enrollmentCounts[c.id] ?? 0,
    creatorName: c.created_by ? creatorNames[c.created_by] ?? null : null,
  }));

  const boardSpaces = spaces.map((s) => ({ id: s.id as string, label: s.name as string }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{isManager ? "My Courses" : "Courses"}</h1>
        {!isManager && (
          <Link
            href="/admin/courses/new"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            + New Course
          </Link>
        )}
      </div>

      <CoursesBoard
        courses={boardCourses}
        spaces={boardSpaces}
        canMove={canMove}
        isManager={isManager}
        initialSpace={searchParams.space ?? "all"}
      />
    </div>
  );
}
