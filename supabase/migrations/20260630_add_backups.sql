-- Run in the Supabase SQL editor. Automated point-in-time backups written by
-- the daily cron (last 14 kept). Optional — the manual Export/Import on the
-- dashboard works without it; this is the hands-off insurance layer.

CREATE TABLE IF NOT EXISTS backups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  bundle     jsonb       NOT NULL
);
CREATE INDEX IF NOT EXISTS backups_created_at_idx ON backups (created_at DESC);
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
