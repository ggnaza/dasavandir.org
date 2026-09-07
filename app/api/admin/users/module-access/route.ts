import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MODULE_IDS, type AccessLevel, type ModuleId } from "@/lib/modules";
import { getModuleGrants, setModuleGrants } from "@/lib/access/module-access";

const VALID_LEVELS: AccessLevel[] = ["none", "member", "ldm"];

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // RLS on profiles means the self-read must use the service role (CLAUDE.md).
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (data?.role !== "admin") return null;
  return user;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return Response.json({ error: "user_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile) return Response.json({ error: "User not found" }, { status: 404 });

  const grants = await getModuleGrants(userId, profile.role);
  // Platform admins have implicit access everywhere; the UI shows that as locked.
  return Response.json({ grants, isPlatformAdmin: profile.role === "admin" });
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    user_id?: string;
    grants?: Record<string, string>;
  };
  if (!body.user_id || !body.grants || typeof body.grants !== "object") {
    return Response.json({ error: "user_id and grants object required" }, { status: 400 });
  }

  const clean: Partial<Record<ModuleId, AccessLevel>> = {};
  for (const id of MODULE_IDS) {
    const level = body.grants[id];
    if (level === undefined) continue;
    if (!VALID_LEVELS.includes(level as AccessLevel)) {
      return Response.json({ error: `Invalid access level for ${id}: ${level}` }, { status: 400 });
    }
    clean[id] = level as AccessLevel;
  }

  const { error } = await setModuleGrants(body.user_id, clean);
  if (error) return Response.json({ error }, { status: 500 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", body.user_id)
    .single();

  return Response.json({ grants: await getModuleGrants(body.user_id, profile?.role ?? null) });
}
