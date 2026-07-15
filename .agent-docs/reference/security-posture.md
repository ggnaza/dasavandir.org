---
provenance: human
template-version: 1.0.0
created: 2026-07-06
last-modified: 2026-07-06
related: [architecture-overview]
tags: [security, audit, posture]
---

# Security posture (audit complete; do not re-raise fixed findings)

**What-it-is:** a full security audit was completed across sessions; all findings are resolved and
deployed. New features can be built without re-auditing existing routes unless a NEW pattern is
introduced.

**Critical (2026-04-26, all fixed):** C1 distributed rate limiter (Upstash Redis) · C2 course-ownership
checks on admin mutations (IDOR) · C3 Google Slides URL hostname validation (SSRF) · C4 CSRF
Origin-vs-Host check in middleware · C5 Drive OAuth tokens AES-256-GCM encrypted in `drive_sessions`.

**HIGH (PR #10, all fixed):** XSS sanitize (isomorphic-dompurify) · Zod validation on API routes ·
password policy in signup handler · audit logging (`lib/audit-log.ts`) · auth rate limiting
(login 10/15min, signup 5/hr) · null-profile 401-before-403 on admin routes · API timeouts.

**MEDIUM/LOW (PR #11, all fixed):** HSTS+COOP headers · global-scope logout token revocation · AI-eval
catch logging · 1 MB payload reject in middleware · RateLimit-* headers · robots.txt + security.txt.

**Remaining (non-code) action items:**
- Create the `audit_logs` table in Supabase (H4 audit logging is inert until it exists).
- Confirm `admin@dasavandir.org` is a monitored inbox (referenced in security.txt).

**Scope:** existing API/auth routes. **Last-verified:** 2026-07-06.
**See also:** [[project-security-audit]] · [[project-roadmap]]
