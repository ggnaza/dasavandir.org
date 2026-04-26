import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit-log";

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(",");
}

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile) return new Response("Unauthorized", { status: 401 });
  if (profile.role !== "admin") return new Response("Forbidden", { status: 403 });

  const [
    { data: learners },
    { data: progress },
    { data: quizResponses },
    { data: sessions },
    { data: lessons },
    { data: courses },
  ] = await Promise.all([
    admin.from("profiles").select("id, full_name, created_at").eq("role", "learner"),
    admin.from("progress").select("user_id, lesson_id, completed_at"),
    admin.from("quiz_responses").select("user_id, score"),
    admin.from("lesson_sessions").select("user_id, duration_seconds"),
    admin.from("lessons").select("id, course_id, title"),
    admin.from("courses").select("id, title"),
  ]);

  const lines: string[] = [
    row(["Learner Name", "Joined", "Lessons Completed", "Quizzes Taken", "Avg Quiz Score (%)", "Time Spent (min)"]),
  ];

  for (const learner of learners ?? []) {
    const done = (progress ?? []).filter((p) => p.user_id === learner.id).length;
    const quizzes = (quizResponses ?? []).filter((r) => r.user_id === learner.id);
    const avg = quizzes.length
      ? Math.round(quizzes.reduce((s, r) => s + (r.score ?? 0), 0) / quizzes.length)
      : null;
    const timeSeconds = (sessions ?? [])
      .filter((s) => s.user_id === learner.id)
      .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    const timeMin = Math.round(timeSeconds / 60);

    lines.push(row([
      learner.full_name,
      learner.created_at ? new Date(learner.created_at).toLocaleDateString() : "",
      done,
      quizzes.length,
      avg,
      timeMin,
    ]));
  }

  await logAudit("export_learners", user.id, req);

  const csv = lines.join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dasavandir-learners-${date}.csv"`,
    },
  });
}
