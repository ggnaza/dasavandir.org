-- Add links JSONB column to lessons for multi-resource attachments
-- Each entry: { label: string, url: string }
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;
