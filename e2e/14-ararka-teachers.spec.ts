import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listArarkaTeachers,
  TEACHER_EMAIL_DOMAIN,
  type ArarkaTeacher,
} from "../lib/ararka/teachers";

/**
 * Ararka teachers are the active learners on the school email domain.
 *
 * The regression this guards: the lookup used to filter on
 * `modules @> {ararka}`. Because `profiles.modules` defaults to `{courses}`,
 * that matched nobody, so the teacher dropdown came back empty and then hid
 * itself — an admin had no way to attribute an import to a teacher, with no
 * error anywhere. These tests assert the query shape directly, so a revert to
 * a modules-based filter fails here rather than silently in production.
 */

interface RecordedCall {
  method: string;
  args: unknown[];
}

/** Minimal thenable stand-in for the PostgREST query builder. */
function stubClient(rows: ArarkaTeacher[]) {
  const calls: RecordedCall[] = [];
  const builder: Record<string, unknown> = {};

  for (const method of ["select", "ilike", "eq", "order", "limit", "neq", "contains"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  // `await query` resolves through this.
  builder.then = (resolve: (v: { data: ArarkaTeacher[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null });

  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

const argsFor = (calls: RecordedCall[], method: string) =>
  calls.filter((c) => c.method === method).map((c) => c.args);

test("teachers are selected by email domain, not by the modules column", async () => {
  const { client, calls } = stubClient([]);
  await listArarkaTeachers(client);

  expect(argsFor(calls, "from")[0]).toEqual(["profiles"]);
  expect(argsFor(calls, "ilike")[0]).toEqual(["email", `%${TEACHER_EMAIL_DOMAIN}`]);

  // The actual regression guard.
  expect(
    argsFor(calls, "contains"),
    "teacher lookup must not filter on profiles.modules — it defaults to {courses} and matches nobody"
  ).toHaveLength(0);
});

test("only active profiles are offered as teachers", async () => {
  const { client, calls } = stubClient([]);
  await listArarkaTeachers(client);

  expect(argsFor(calls, "eq")).toContainEqual(["status", "active"]);
});

test("the caller is excluded from their own teacher list", async () => {
  const { client, calls } = stubClient([]);
  await listArarkaTeachers(client, "user-123");

  expect(argsFor(calls, "neq")).toContainEqual(["id", "user-123"]);
});

test("no exclusion is applied when no caller id is given", async () => {
  const { client, calls } = stubClient([]);
  await listArarkaTeachers(client);

  expect(argsFor(calls, "neq")).toHaveLength(0);
});

test("rows are returned to the caller", async () => {
  const rows: ArarkaTeacher[] = [
    { id: "1", full_name: "Anna", email: `anna${TEACHER_EMAIL_DOMAIN}` },
    { id: "2", full_name: null, email: `bob${TEACHER_EMAIL_DOMAIN}` },
  ];
  const { client } = stubClient(rows);

  expect(await listArarkaTeachers(client)).toEqual(rows);
});
