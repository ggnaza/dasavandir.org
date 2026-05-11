import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { AnnouncementCard } from "@/components/announcement-card";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("course_id")
    .eq("user_id", user.id);

  const courseIds = (enrollments ?? []).map((e) => e.course_id);

  type RawAnnouncement = {
    id: string;
    title: string;
    body: string;
    created_at: string;
    courses: { title: string } | null;
    profiles: { full_name: string | null } | null;
    announcement_reactions: { id: string; emoji: string; user_id: string }[];
    announcement_comments: {
      id: string;
      body: string;
      user_id: string;
      created_at: string;
      profiles: { full_name: string | null } | null;
    }[];
  };

  let announcements: RawAnnouncement[] = [];
  if (courseIds.length > 0) {
    const { data } = await admin
      .from("announcements")
      .select(`
        id, title, body, created_at,
        courses ( title ),
        profiles!author_id ( full_name ),
        announcement_reactions ( id, emoji, user_id ),
        announcement_comments (
          id, body, user_id, created_at,
          profiles!user_id ( full_name )
        )
      `)
      .in("course_id", courseIds)
      .order("created_at", { ascending: false });

    announcements = (data as unknown as RawAnnouncement[]) ?? [];
  }

  const items = announcements.map((a) => {
    const reactionMap: Record<string, { count: number; reacted: boolean }> = {};
    for (const r of a.announcement_reactions ?? []) {
      if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, reacted: false };
      reactionMap[r.emoji].count++;
      if (r.user_id === user.id) reactionMap[r.emoji].reacted = true;
    }
    const reactions = Object.entries(reactionMap).map(([emoji, data]) => ({ emoji, ...data }));

    const comments = (a.announcement_comments ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      user_id: c.user_id,
      author: c.profiles?.full_name ?? "Unknown",
      created_at: c.created_at,
    }));

    return {
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.created_at,
      author: a.profiles?.full_name ?? "Unknown",
      courseTitle: a.courses?.title ?? "Course",
      reactions,
      comments,
    };
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Announcements</h1>

      {!items.length && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-base">No announcements yet.</p>
          <p className="text-sm mt-1">Check back later — your instructors will post updates here.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <AnnouncementCard key={item.id} {...item} currentUserId={user.id} />
        ))}
      </div>
    </div>
  );
}
