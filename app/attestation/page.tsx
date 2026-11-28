import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAttestationUser, invitedTestIds } from "@/lib/attestation/server";
import { finalizeExpired } from "@/lib/attestation/attempts";
import { visibleTests } from "@/lib/attestation-core";

export const dynamic = "force-dynamic";

/** The teacher's list of published tests and where they stand. No scores are shown. */
export default async function AttestationHome() {
  const user = await getAttestationUser();
  if (!user) redirect("/learn");

  const admin = createAdminClient();
  // An attempt whose time ran out counts as submitted, not "continue".
  const { data: openRows } = await admin
    .from("attestation_attempts")
    .select("test_id")
    .eq("user_id", user.id)
    .eq("status", "in_progress");
  await finalizeExpired(Array.from(new Set((openRows ?? []).map((r) => r.test_id as string))));

  const [{ data: allTests }, { data: attempts }, invited] = await Promise.all([
    admin
      .from("attestation_tests")
      .select("id, subject, title, description, time_limit_minutes, max_attempts")
      .eq("status", "published")
      .order("subject"),
    admin.from("attestation_attempts").select("test_id, status").eq("user_id", user.id),
    user.isManager ? Promise.resolve(null) : invitedTestIds(user.id),
  ]);
  // Teachers see only the tests they were invited to; managers see every published test.
  const tests = visibleTests(allTests ?? [], invited);

  const statusOf = (t: { id: string; max_attempts: number }) => {
    const mine = (attempts ?? []).filter((a) => a.test_id === t.id);
    if (mine.some((a) => a.status === "in_progress")) return "in_progress" as const;
    const submitted = mine.filter((a) => a.status === "submitted").length;
    if (submitted >= t.max_attempts) return "done" as const;
    return submitted > 0 ? ("retake" as const) : ("new" as const);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Կամավոր ատեստավորման թեստեր</h1>
        {user.isManager && (
          <Link href="/attestation/manage" className="text-sm text-violet-700 underline">
            Manage tests →
          </Link>
        )}
      </div>
      {(tests ?? []).length === 0 ? (
        <p className="text-gray-500">Այս պահին Ձեզ համար հասանելի թեստեր չկան։ Եթե սպասում եք հրավերի, դիմեք TFA-ի համակարգողին։</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(tests ?? []).map((t) => {
            const s = statusOf(t);
            return (
              <li key={t.id} className="bg-white rounded-xl border p-4 flex flex-col gap-2">
                <p className="text-xs text-gray-500">{t.subject}</p>
                <p className="font-medium">{t.title}</p>
                {t.time_limit_minutes && <p className="text-xs text-gray-500">Տևողություն՝ {t.time_limit_minutes} րոպե</p>}
                <div className="mt-auto pt-2">
                  {s === "done" ? (
                    <span className="text-sm text-green-700">✓ Հանձնված է</span>
                  ) : (
                    <Link
                      href={`/attestation/take/${t.id}`}
                      className="inline-block px-4 py-2 rounded-lg bg-violet-600 text-white text-sm"
                    >
                      {s === "in_progress" ? "Շարունակել" : s === "retake" ? "Կրկին հանձնել" : "Սկսել"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
