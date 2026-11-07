-- Preview/test database only.
-- Adds the columns required by the current moderated listing API.
-- Non-destructive: existing rows and the legacy image_url column are preserved.
-- Apply once to royal-ai-business-center-test after confirming Preview DB binding.

ALTER TABLE listings ADD COLUMN contact_name TEXT;
ALTER TABLE listings ADD COLUMN contact_phone TEXT;
ALTER TABLE listings ADD COLUMN area_sqm REAL;
ALTER TABLE listings ADD COLUMN images TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listings ADD COLUMN reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON listings(status, created_at);
