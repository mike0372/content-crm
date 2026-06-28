-- Add content_type column to content_items
-- Run this in the Supabase SQL editor: https://app.supabase.com/project/ygqexrticqsjhrnrwlxu/sql/new
--
-- Values: reel_short | reel_long | post | carousel | informative
-- Default: reel_long (existing rows default to Reel Long)

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'reel_long'
  CHECK (content_type IN ('reel_short', 'reel_long', 'post', 'carousel', 'informative'));
