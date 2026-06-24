import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client using the service_role key. This key bypasses
// Row Level Security, so it must NEVER be exposed to the browser. Every file
// that imports this module is server-only (API routes + server components).

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
