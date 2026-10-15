---
provenance: llm-reviewed
status: accepted
template-version: 1.0.0
created: 2026-10-15
last-modified: 2026-10-15
work-unit: null
supersedes: []
superseded-by: null
related: [efficacy-original-vs-port, staging-shares-the-production-database, module-access-is-the-live-ldm-source]
tags: [architecture, efficacy, identity, vercel, supabase, migration]
---

# ADR-0009 — Re-host Vahe's original Efficacy tool on our Vercel + Supabase (replace the August rebuild)

## Context
The August–September 2026 "port" (PRs #308–#311, #325–#328) rewrote the tool from scratch in Next.js
and dropped most of it: the AI lesson-video evaluation, the knowledge base, PDF exports and Vahe's UI.
See `reference/efficacy-original-vs-port.md`. What the operator wants is Vahe's tool
(`vahehovsepyantfa-sketch/teacher-efficancy-tool`) running exactly as he built it, but hosted on TFA's
Vercel + Supabase, with a teacher being the same person in the LMS and in Efficacy.

Interview answers (2026-10-15):

| Topic | Answer |
|---|---|
| Ownership | Vahe keeps developing it on the moved version, and his Claude is connected to it |
| Baseline | `main` (`4496a32`) **plus** `claude/limit-ai-evaluation-concurrency` and `claude/ui-ux-improvements` |
| Login | Only the LMS account (email or Google). Vahe's register/login screens are removed |
| Repo | A new repo with its own Vercel project. Vahe is a collaborator and gets no access to the LMS repo |
| Vercel plan | Pro |
| Video jobs | Stay on Vercel, restructured into short background steps |
| Dev database | A separate dev Supabase project. Vahe gets no production keys |
| Role admin | Vahe's User Management screen, listing LMS accounts. LMS admins are Efficacy admins automatically |
| Cross-data | All three: a shared login/profile; Efficacy scores in LMS reporting; LMS progress inside Efficacy |
| Old rebuild | Delete after cutover. It currently holds only 2 `chat_configs` rows and 2 `module_access` grants |
| Mongo data | Unknown. Vahe's Render deployment is still live (HTTP 200), so we need his `MONGO_URI` to check |

## Alternatives Considered
- **Keep and extend the August rebuild.** Rejected: it is a different product. Bringing it to parity
  means rebuilding about 15k lines of Vahe's work a second time, and every future change Vahe makes
  would have to be re-ported by hand.
- **Put the tool in the LMS repo** (`apps/efficacy`). Rejected: Vahe would need write access to the
  whole LMS, including service-role code paths. It also inherits the LMS headers
  (`Permissions-Policy: microphone=()` would break his voice input) and the LMS deploy cadence.
- **Connect Vahe's own repo to our Vercel.** Rejected by the operator: TFA should own the repo that
  production deploys from.
- **Keep MongoDB (Atlas) and share only the login.** Rejected: the operator wants it on Supabase, and
  the cross-tool reporting needs SQL joins against `profiles`.
- **Store Mongo documents as JSONB blobs** to avoid touching his queries. Rejected: the LMS reporting
  views need real columns, and JSONB would push query logic into the app.
- **Run the video evaluation on a separate always-on worker** (Render or Railway). Rejected by the
  operator: it adds a third host. The cost is restructuring one service file into steps.
- **Build on the existing `efficacy` schema.** Rejected: its tables were shaped for the rebuild, not
  for Vahe's models, and the rebuild must keep working until cutover. A new schema avoids touching it.

## Non-breakage guarantees (operator condition of approval, 2026-10-15)
Approved on the condition that **nothing on Vahe's side breaks** and **nothing in the LMS breaks**.
- **Vahe's side stays exactly as is.** Nothing is ever written to `vahehovsepyantfa-sketch/teacher-efficancy-tool`:
  no push, no branch, no PR, no settings change, no webhook. Our clone has its `origin` remote removed
  right after cloning, so a push to his repo cannot happen by accident. His Render deployment, his
  MongoDB and his env vars are not touched, and the data migration (section 7) only **reads** from Mongo.
  Both versions run side by side until the operator decides otherwise.
- **The LMS is not broken.** Until cutover, every database change is **additive**: the new
  `efficacy_app` schema and new read-only views. No existing table, column, trigger, RLS policy or
  function in `public` is altered. `handle_new_user()` and `profiles` are untouched. The August
  `efficacy` schema and routes stay live until step 8.3. LMS code changes are limited to the
  section 5 score panel and the step 8 cleanup, each in its own PR to `staging`, and each passes
  `npm run build` and the e2e suite before merge. Single sign-on (cookie domain) is out of scope until
  after cutover and gets its own approval.
- The new Vercel project never takes over an LMS domain. Only the two `efficacy` subdomains move, at
  cutover, and only after staging acceptance.

## Decision

### 1. Repository
- New private repo **`ggnaza/efficacy`**, created from Vahe's repo with full history so his commits
  stay attributable. Its `main` = his `main` with the two `claude/*` branches merged in.
- Branches: `main` deploys to production and `staging` deploys to staging. Changes land through PRs.
  Vahe opens PRs and Gor merges, matching the LMS rule that everything ships to `staging` first.
- A repo `CLAUDE.md` for Vahe's Claude covers the stack, the dev database, the identity contract in
  section 3, the rule that migrations are applied by hand to production, and the do-not-break list.
- Vahe's original repo is left alone and becomes the archive.

### 2. Runtime: keep his code, swap two layers
- `frontend/` (React 18 + Vite + React Router + axios, TFA design system) is **kept as is**, apart
  from the login swap in section 3.
- `backend/` (Express) is **kept as is**: routes, controllers and services. The Express `app` is
  exported and served as one Vercel Node function under `/api/*`. The Vite build is served as static
  files with an SPA rewrite. The exact Vercel wiring must be currency-checked against current Vercel
  docs before building.
- **Mongoose is replaced, not the code that calls it.** Each of the 11 models becomes a module with
  the same name in `backend/models/`, implemented on `@supabase/supabase-js` (service role, server
  only), exposing only the query shapes the controllers actually use. Controllers change only where a
  Mongo-only idiom has no direct equivalent (for example `populate`), and each such change is listed
  in the PR.
- Data lives in a new Postgres schema, **`efficacy_app`**, with one table per model. Columns are
  snake_case versions of the Mongoose fields, primary keys are `uuid`, and embedded sub-documents
  (rubric scores, chat messages, stages) are `jsonb` columns. RLS is enabled with no policies: only the
  server, using the service role, can read or write.
- Knowledge chunk `embedding` is stored as `real[]`. Similarity stays computed in JS exactly as in
  `knowledgeService.js`, with pgvector deferred. This keeps retrieval behaviour identical.
- Gemini: TFA's key in Vercel env (`GEMINI_API_KEY`, `GEMINI_MODEL`). PDFKit + the bundled DejaVu fonts
  are included in the function bundle.
- Headers: his `render.yaml` header set moves into the new project's `vercel.json`, including
  `microphone=(self)`, with `connect-src` extended to `https://*.supabase.co`.

### 3. Identity contract (LMS ⇄ Efficacy)
- **One user = one `auth.users` row = one `public.profiles` row** in the LMS Supabase project
  (`mmkmsudwtrqdzehnfctx`). Every `user` reference in `efficacy_app` is a `uuid` FK to `profiles(id)`.
- **Login:** Vahe's Login/Register pages are replaced by a sign-in page that uses Supabase Auth in the
  same project (email + password, and Google), so people use their existing dasavandir.org
  credentials. axios sends the Supabase access token, and `authMiddleware.js` verifies it with
  Supabase instead of his JWT secret. bcrypt, JWT issuing, `/auth/register` and
  `/auth/bootstrap-admin` are removed.
- **Who may enter:** an account needs a `public.module_access` row with `module='efficacy'`, or must be
  an LMS `admin`. This is the same rule the LMS already enforces (`lib/access/module-access.ts`).
- **Role mapping:** LMS `profiles.role='admin'` → `admin`; `module_access.access='ldm'` → `ldm`;
  `access='member'` → `teacher`. Role is never read from user metadata (CLAUDE.md auth rule 2).
- **Vahe's User Management screen** keeps its UI but works on LMS accounts:
  - *List*: LMS profiles with Efficacy access, plus a search over all LMS accounts to grant access.
  - *Change role*: writes `module_access.access`.
  - *Assign LDM*: writes `efficacy_app.teacher_settings.assigned_ldm_id`, replacing `User.assignedLdm`.
  - *Create user*: invites by email with Supabase Auth, then runs the same defensive profile upsert as
    the LMS's `ensureProfile` (CLAUDE.md: never rely on the trigger alone). New accounts are LMS
    `learner`s, plus an Efficacy grant.
  - *Delete* / *Permanent delete*: **revoke Efficacy access only**. Efficacy can never delete an LMS
    account. *(Changed during build, see Addendum B: the person's `efficacy_app` records are kept,
    not deleted.)*
  - *Approve / Reject* (self-registration queue): removed, since nobody self-registers any more.
- **Single sign-on across subdomains** (log in to the LMS and already be logged in to Efficacy) needs
  the LMS auth cookie scoped to `.dasavandir.org`. That is a change to LMS auth, the most fragile part
  of the codebase, so it ships as **its own PR after cutover** with its own smoke test. Until then
  users sign in to Efficacy with the same account.

### 4. AI video evaluation on Vercel (the one restructured service)
- Same inputs (Drive links to the video and lesson plan), same stages, same status values, same live
  progress UI and same output. Only how the job runs changes.
- The job becomes a state machine stored on the `ai_evaluations` row. Each step runs as a short
  background invocation (under 800 s) and schedules the next one:
  1. fetch metadata and the lesson plan;
  2. stream the video from Drive straight into a Gemini Files resumable upload, without `/tmp`, in
     chunks resumed across invocations;
  3. poll Gemini processing in short checks, for up to the existing 30-minute budget;
  4. generate, then save the result.
- Vahe's queue branch (concurrency limit, queue position, ETA) is kept, backed by the table instead of
  in-process memory.
- Knowledge-source video transcription uses the same runner.
- The background mechanism (Vercel Queues, Workflow, or a cron-driven tick) is chosen after a
  currency check and recorded as an addendum to this ADR before that code is written.

### 5. Cross-tool data
- **Efficacy → LMS:** a read-only view, `public.efficacy_teacher_scores_v`, with per-teacher counts and
  averages of sent observations, latest competency evaluation date and score, and reflection count.
  The LMS admin learner/user detail shows these scores and links to the teacher in Efficacy. The LMS
  reads only this view, never `efficacy_app` tables.
- **LMS → Efficacy:** a read-only view, `efficacy_app.lms_progress_v`, with each user's enrolled
  courses, progress % and last activity. Vahe's teacher profile screen (LDM view) gets one added
  "LMS courses" panel. This is the only UI addition to his tool. Efficacy reads only this view, never
  LMS tables.
- The two views are the stable contract between the repos: either side can change its internals
  without breaking the other.

### 6. Environments and Vahe's access
- **Dev:** a new free Supabase project, `efficacy-dev`, built from the efficacy repo's own
  `supabase/migrations/`. That covers `efficacy_app`, plus stub `profiles` / `module_access` / the two
  views and a seed script with test users. It uses a separate dev Gemini key. Vahe's Claude gets
  **only** dev keys.
- **Staging and production** both point at `mmkmsudwtrqdzehnfctx`, since staging already shares the
  production database. `efficacy_app` migrations are pasted by Gor following the CLAUDE.md "exact
  paste" rule.
- Domains: `efficacy.dasavandir.org` and `staging.efficacy.dasavandir.org` move from the LMS Vercel
  project to the new one at cutover.

### 7. Data migration (conditional)
Once Vahe provides `MONGO_URI`: count documents per collection. If there is real data, a one-time
import script maps Mongo `_id`s to new uuids and matches users to LMS profiles **by email**. Users with
no LMS account are listed for the operator to decide (invite or skip) before the import runs. The
script is dry-run first and reports counts per collection before and after.

### 8. Cutover and removal of the rebuild
1. Deploy the new project to `staging.efficacy.dasavandir.org` and pass the acceptance list below.
2. Move the production domain. Remove the `efficacy` hosts from LMS `middleware.ts`/`lib/modules.ts`
   (the module switcher keeps linking to the subdomain).
3. A separate LMS PR deletes `app/efficacy/`, `app/api/efficacy/`, `components/efficacy/` and
   `lib/efficacy/`, plus a migration dropping the old `efficacy` schema. The 2 `chat_configs` rows are
   checked against Vahe's defaults before the drop. `module_access` rows are kept, since they are the
   shared grant.

### Acceptance (all checked hands-on on staging)
- Every route in Vahe's `backend/routes/*` (about 55) responds as in his Render deployment. A
  route-by-route parity checklist is kept in the efficacy repo.
- Every page matches his deployment, checked with side-by-side screenshots at desktop and phone width.
- A real Drive lesson video of 1 GB or more completes an AI evaluation end to end, with live stages.
- A teacher signs in with their LMS password and with Google. Someone without an Efficacy grant is
  refused. Changing a role in Vahe's screen is reflected on the LMS users page, and the reverse.
- An LMS admin sees a teacher's Efficacy scores. An LDM sees that teacher's LMS course progress.
- Vahe's Claude can clone the repo, run it against `efficacy-dev` and open a PR, without any
  production secret.

## Consequences
- There are two repos and two Vercel projects sharing one Supabase project. The identity contract
  (section 3) and the two views (section 5) are the integration points; anything else crossing
  between them is a defect.
- Vahe's future work merges with little friction because his routes, controllers, services and UI keep
  their shape. The cost is a Supabase-backed model layer that has to keep up with his model changes.
- Single sign-on is deferred until after cutover, so for a short period people sign in twice with the
  same account.
- **Open items:** OQ (Mongo data) needs Vahe's `MONGO_URI`. OQ (repo name and owner) defaults to
  `ggnaza/efficacy`. OQ (Vercel seat for Vahe): Vahe works through GitHub PRs and preview links, with
  no Vercel seat unless the operator wants one.

## Addendum A (2026-10-15) — currency check and the background-job mechanism
Checked against current Vercel docs (Express page updated 2026-08-10; Functions limits and duration
pages updated 2026-08-24; Workflows page updated 2026-09-04) and workflow-sdk.dev (updated 2026-10-13):
- **Express on Vercel:** zero-config. A `server.js`/`index.js`/`app.js` that default-exports the app
  (`module.exports = app`) becomes one Vercel Function on Fluid compute. `express.static()` is ignored;
  static files must come from `public/**`. So Vahe's `server.js` only needs `module.exports = app`
  (keeping `app.listen` for local dev), and the Vite build output is served as static files.
- **Limits (Pro):** 800 s maximum duration is GA; 1800 s is beta (per function, nodejs22.x/24.x only).
  Request and response bodies are capped at **4.5 MB**. Memory is up to 4 GB.
- **Vercel Workflow** is GA, but on Express it requires a Nitro build (`workflow/nitro`) and its
  examples are ESM. That would restructure Vahe's CommonJS backend.

**Chosen mechanism: a database-driven step runner.** The `ai_evaluations` row (and a knowledge
source's row) holds `stage`, `status` and a small `job_state` jsonb (Gemini upload URL, byte offset,
Gemini file name, attempt count). One endpoint, `POST /api/jobs/tick` (protected by `CRON_SECRET`),
advances every due job by one step, each step under 800 s. It is called (a) right after a job is
created, through `waitUntil`, and (b) by a Vercel cron **every minute** as the safety net. Steps:
metadata and plan → video upload in byte ranges (Drive range GET → Gemini resumable-upload chunk,
resumable across ticks, no `/tmp`) → one Gemini processing check per tick (30-minute budget preserved)
→ generate and save. The queue/concurrency limit from Vahe's branch becomes a row-level claim
(`FOR UPDATE SKIP LOCKED` equivalent through an RPC), so two ticks never run the same job.
- *Rejected:* Vercel Workflow (needs Nitro/ESM restructuring of his backend); Vercel Queues used
  directly (beta per secondary sources, and adds a dependency for something one table can do); a single
  1800 s function (beta, and Gemini processing can exceed it once the upload time is added).
- **New constraint found — 4.5 MB body cap.** Any upload route in his tool that takes a file in the
  request body (knowledge-base files) and is larger than 4.5 MB must move to a direct browser upload to
  Supabase Storage via a signed URL, with the server then reading it from Storage. To be confirmed
  per route when porting `knowledgeController`.

## Addendum B (2026-10-15) — decisions taken while building (repo `ggnaza/efficacy`, PR #1)
- **Data layer:** Vahe's Mongoose schemas are kept for casting, defaults, validation and toJSON.
  `backend/db/supabaseModel.js` replaces only persistence (find / save / populate / ...). Refs are
  stored as uuids and held as Mixed so populated objects behave as before. Unsupported query
  shapes throw instead of returning wrong data. Results are paged past PostgREST's 1000-row cap.
- **Users:** read from the view `efficacy_app.users_v` (profiles ⋈ module_access ⋈ teacher_settings).
  The Efficacy-only admin flag is `teacher_settings.efficacy_admin`, never `profiles.role`.
  - *Rejected:* adding `'admin'` to `module_access.access`. That is an LMS schema change, and LMS
    code reads that column.
- **Removal keeps records:** *Permanent delete* deletes the `module_access` efficacy row and
  `teacher_settings`, and keeps reflections and observations. Re-granting access restores them.
  - *Rejected:* deleting the person's `efficacy_app` rows. It's irreversible, and Vahe's original
    also kept them (orphaned).
- **Password reset** from Efficacy works only when the target's LMS role is `learner`. Otherwise
  an Efficacy admin could take over an LMS admin, creator or manager account.
- **Job kick:** the creating request runs `tick()` inside `waitUntil` (same invocation, 800 s
  `maxDuration`). The per-minute cron is the safety net.
  - *Rejected:* an HTTP self-call to `VERCEL_URL`. Deployment Protection blocks it on preview and
    staging URLs.
  - The startup sweep that failed "stuck" evaluations was removed: on serverless it would fail
    live jobs. Expired row locks handle crashed steps instead.
- **Cross-tool views** are `security_invoker`, with SELECT for `service_role` only. Supabase's
  default grants on new `public` views (anon/authenticated) are explicitly revoked, or every LMS
  user could read teacher scores over REST.
- **LMS side:** the admin user Activity page (`app/admin/users/[id]/activity`) shows an "Efficacy
  tool" section from `efficacy_teacher_scores_v` and links to `moduleUrl('efficacy', host)`.
  It is hidden when the view is absent or the user has no grant.
- **Known follow-up:** RAG retrieval still loads up to 4000 chunk embeddings and ranks them in JS
  (unchanged behaviour). Over PostgREST that gets slow as the knowledge base grows. Move ranking to
  pgvector when chunk count passes about 1000.
