-- Run in the Supabase SQL editor. Append-only history of per-post metrics.
-- The live `instagram_posts` table still holds only the latest 50-media window
-- (pruned each sync); this table accumulates one datapoint per post per sync so
-- a reel that scrolls out of that window keeps its full metric history and the
-- /performance time-series chart has data. The app degrades gracefully (no
-- snapshots written, chart shows a "collecting history" hint) until applied.

CREATE TABLE IF NOT EXISTS instagram_post_snapshots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        text        NOT NULL,
  account_id     text        NOT NULL,
  taken_at       timestamptz NOT NULL DEFAULT now(),
  plays          integer     NOT NULL DEFAULT 0,
  reach          integer     NOT NULL DEFAULT 0,
  saved          integer     NOT NULL DEFAULT 0,
  shares         integer     NOT NULL DEFAULT 0,
  impressions    integer     NOT NULL DEFAULT 0,
  like_count     integer     NOT NULL DEFAULT 0,
  comments_count integer     NOT NULL DEFAULT 0,
  avg_watch_time numeric     NOT NULL DEFAULT 0,
  partial        boolean     NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS ig_post_snapshots_post_idx ON instagram_post_snapshots (post_id, taken_at);
CREATE INDEX IF NOT EXISTS ig_post_snapshots_acct_idx ON instagram_post_snapshots (account_id, taken_at);
ALTER TABLE instagram_post_snapshots ENABLE ROW LEVEL SECURITY;
