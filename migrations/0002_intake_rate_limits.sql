-- Shared, hashed-IP rate limiting for the public website intake endpoint.
-- Stores no raw IP address or submitted customer data.
CREATE TABLE IF NOT EXISTS intake_rate_limits (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
