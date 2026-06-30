-- Run in the Supabase SQL editor. The app degrades gracefully until this is
-- applied (token falls back to env; AI cost panel shows zero), so there is no
-- rush — but the rotatable token + cost tracking only persist once these exist.

-- Key/value app config. Holds the rotatable Instagram long-lived token
-- ({ token, expiresAt }) so it can be refreshed without a redeploy.
CREATE TABLE IF NOT EXISTS app_config (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- One row per Claude call — powers the dashboard cost panel and the optional
-- monthly budget cap (AI_MONTHLY_USD_BUDGET).
CREATE TABLE IF NOT EXISTS ai_usage (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  route         text        NOT NULL,
  model         text        NOT NULL,
  input_tokens  integer     NOT NULL DEFAULT 0,
  output_tokens integer     NOT NULL DEFAULT 0,
  cost_usd      numeric     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON ai_usage (created_at);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
