-- Update deprecated Gemini preview model IDs to current GA versions
UPDATE settings
SET value = 'gemini-2.5-flash'
WHERE key IN ('ai_model', 'ai_coach_model')
  AND value = 'gemini-2.5-flash-preview-04-17';

UPDATE settings
SET value = 'gemini-2.5-pro'
WHERE key IN ('ai_model', 'ai_coach_model')
  AND value IN ('gemini-2.5-pro-preview-05-06', 'gemini-2.5-pro-preview-06-05');
