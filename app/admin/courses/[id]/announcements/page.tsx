import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { CreateAnnouncementForm } from "./create-form";
import { AnnouncementCard } from "@/components/announcement-card";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "course_creator", "course_manager"].includes(profile.role)) {
    redirect("/learn");
  }

  const { data: course } = await admin
    .from("courses")
    .select("id, title")
    .eq("id", params.id)
    .single();

  if (!course) notFound();

  type RawAnnouncement = {
    id: string;
    title: string;
    body: string;
    created_at: string;
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

  const { data } = await admin
    .from("announcements")
    .select(`
      id, title, body, created_at,
      profiles!author_id ( full_name ),
      announcement_reactions ( id, emoji, user_id ),
      announcement_comments (
        id, body, user_id, created_at,
        profiles!user_id ( full_name )
      )
    `)
    .eq("course_id", params.id)
    .order("created_at", { ascending: false });

  const announcements = (data as unknown as RawAnnouncement[]) ?? [];

  const items = announcements.map((a) => {
    const reactionMap: Record<string, { count: number; reacted: boolean }> = {};
    for (const r of a.announcement_reactions ?? []) {
      if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, reacted: false };
      reactionMap[r.emoji].count++;
      if (r.user_id === user.id) reactionMap[r.emoji].reacted = true;
    }
    const reactions = Object.entries(reactionMap).map(([emoji, d]) => ({ emoji, ...d }));

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
      courseTitle: course.title,
      reactions,
      comments,
    };
  });

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
        <p className="text-sm text-gray-500 mt-1">
          Announcements are sent to all enrolled students by email and in-app notification.
        </p>
      </div>

      <CreateAnnouncementForm courseId={params.id} isCourseManager={profile.role === "course_manager"} />

      <div className="mt-8 space-y-4">
        {!items.length && (
          <p className="text-sm text-gray-400 text-center py-8">No announcements yet.</p>
        )}
        {items.map((item) => (
          <AnnouncementCard key={item.id} {...item} currentUserId={user.id} />
        ))}
      </div>
    </div>
  );
}
