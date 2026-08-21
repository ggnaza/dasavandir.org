-- Course payments: single-course purchase orders + a subscription-availability flag (future).
-- Additive, idempotent. Apply to STAGING first, then prod. The payment FLOW is gated by the
-- PAYMENTS_MODE env var (disabled | mock | arca | stripe) — this migration only adds storage.

create table if not exists course_orders (
  id uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  course_id   uuid not null references courses(id)  on delete cascade,
  org_id      uuid references organizations(id),
  amount_amd  integer not null,
  currency    text not null default 'AMD',
  status      text not null default 'pending' check (status in ('pending','paid','failed','cancelled')),
  provider    text,          -- 'mock' | 'arca' | 'stripe' | …
  provider_ref text,         -- the gateway's payment/order id
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists course_orders_user_idx   on course_orders (user_id);
create index if not exists course_orders_course_idx on course_orders (course_id);

alter table course_orders enable row level security;
drop policy if exists course_orders_self_read on course_orders;
create policy course_orders_self_read on course_orders
  for select to authenticated
  using (user_id = auth.uid());

-- Future subscription model: which paid courses are included in a subscription.
alter table courses add column if not exists subscription_available boolean not null default false;
