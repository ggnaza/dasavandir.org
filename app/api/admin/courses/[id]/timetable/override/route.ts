import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTimetableAccess } from "@/lib/timetable/access";
import { z } from "zod";

/**
 * Per-group timetable overrides (ADR-0005, Model B).
 *
 * A moderator may adjust ONLY slots the creator has ticked (moderator_adjustable),
 * and ONLY for a group they moderate. Both are enforced here, server-side, with the
 * admin client — the RLS policies on timetable_entry_overrides say the same thing
 * but are inert today (OQ-003: role predicates through `profiles` recurse), so this
 * route is the real gate, not a convenience.
 */

const patchSchema = z.object({
  entry_id: z.string().uuid(),
  group_id: z.string().uuid(),
  title: z.string().min(1).max(300).nullable().optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  location: z.string().min(1).max(300).nullable().optional(),
  location_type: z.enum(["online", "in_person"]).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  hidden: z.boolean().optional(),
});

const deleteSchema = z.object({
  entry_id: z.string().uuid(),
  group_id: z.string().uuid(),
});

/** PUT — create or update this group's override for one entry. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { entry_id, group_id, ...patch } = parsed.data;

  const admin = createAdminClient();
  const access = await getTimetableAccess(admin, params.id, user.id);

  // A creator/admin may adjust any group; a moderator only their own.
  const mayTouchGroup =
    access.canEditBase || access.moderatedGroups.some((g) => g.id === group_id);
  if (!mayTouchGroup) return new Response("Forbidden", { status: 403 });

  // The entry must belong to this course, and be ticked — unless the caller owns
  // the base, in which case the tick is their own control and does not gate them.
  const { data: entry } = await admin
    .from("timetable_entries")
    .select("id, course_id, moderator_adjustable")
    .eq("id", entry_id)
    .eq("course_id", params.id)
    .maybeSingle();

  if (!entry) return new Response("Entry not found on this course", { status: 404 });
  if (!access.canEditBase && !entry.moderator_adjustable) {
    return new Response("This session is not open for group adjustments.", { status: 403 });
  }

  // The group must belong to this course — otherwise a moderator of a group on
  // course B could attach an override to course A's entry.
  const { data: group } = await admin
    .from("course_groups")
    .select("id")
    .eq("id", group_id)
    .eq("course_id", params.id)
    .maybeSingle();
  if (!group) return new Response("Group not found on this course", { status: 404 });

  const { data: saved, error } = await admin
    .from("timetable_entry_overrides")
    .upsert(
      { entry_id, group_id, ...patch, updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: "entry_id,group_id" },
    )
    .select()
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(saved);
}

/** DELETE — drop this group's override, reverting the slot to the shared base. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json());
  if (!parsed.success) return new Response("Invalid input", { status: 400 });
  const { entry_id, group_id } = parsed.data;

  const admin = createAdminClient();
  const access = await getTimetableAccess(admin, params.id, user.id);
  const mayTouchGroup =
    access.canEditBase || access.moderatedGroups.some((g) => g.id === group_id);
  if (!mayTouchGroup) return new Response("Forbidden", { status: 403 });

  // Scope the delete through the entry's course so a valid (entry, group) pair from
  // another course cannot be deleted via this route.
  const { data: entry } = await admin
    .from("timetable_entries")
    .select("id")
    .eq("id", entry_id)
    .eq("course_id", params.id)
    .maybeSingle();
  if (!entry) return new Response("Entry not found on this course", { status: 404 });

  const { error } = await admin
    .from("timetable_entry_overrides")
    .delete()
    .eq("entry_id", entry_id)
    .eq("group_id", group_id);

  if (error) return new Response(error.message, { status: 500 });
  return new Response("OK");
}
