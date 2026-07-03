-- Presence: track when each user was last active on the platform.
-- Updated by a lightweight heartbeat (POST /api/presence) from the app layout.
-- Run this in Supabase → SQL Editor. Idempotent.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
