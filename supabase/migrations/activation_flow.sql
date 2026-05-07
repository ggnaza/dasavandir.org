-- Run once in Supabase → SQL Editor

-- Add status to profiles (default 'active' keeps existing users unchanged)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('pending', 'active'));

-- Activation tokens for self-registered users
CREATE TABLE IF NOT EXISTS activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activation_tokens ENABLE ROW LEVEL SECURITY;

-- Only accessible via service role key
CREATE POLICY "Service role only" ON activation_tokens
  FOR ALL USING (false) WITH CHECK (false);
