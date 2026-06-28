-- Run this in the Supabase SQL editor to enable Edward conversation history.

CREATE TABLE IF NOT EXISTS agent_conversations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  messages      jsonb       NOT NULL DEFAULT '[]',
  message_count integer     GENERATED ALWAYS AS (jsonb_array_length(messages)) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Reuse the existing set_updated_at() trigger function if it exists,
-- or create it if it doesn't.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER agent_conversations_updated_at
    BEFORE UPDATE ON agent_conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
