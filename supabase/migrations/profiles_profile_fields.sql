-- Learner profile page: self-service profile fields + a public avatars bucket.
-- Additive, idempotent. Apply to STAGING first, then prod.

alter table profiles add column if not exists avatar_url   text;
alter table profiles add column if not exists region       text;
alter table profiles add column if not exists linkedin_url text;
alter table profiles add column if not exists bio          text;

-- Public bucket for avatars (uploads go via the service-role client; public read for display).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
