-- Multi-tenancy Phase 0b — org_id on courses (ADR-0004, WU-0007)
-- Additive, idempotent. courses is the anchor most tenant data hangs off.
-- org_id is NULLABLE for now (app does not stamp it until Phase 1; enforcement/NOT NULL come later,
-- pre-Phase-2, to avoid NULL rows vanishing under RLS before app stamping is universal).
-- Apply to STAGING first. Backfill sets all existing courses → AEI (single org today).

alter table courses add column if not exists org_id uuid references organizations(id);

update courses
set org_id = (select id from organizations where slug = 'aei')
where org_id is null;

create index if not exists courses_org_id_idx on courses (org_id);
