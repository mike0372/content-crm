import "server-only";
import { getSupabase } from "./supabase";

// ============================================================================
// Instagram long-lived token lifecycle.
//
// Meta long-lived tokens expire ~every 60 days. Previously the token was read
// straight from env with no refresh, so it silently died and stopped all sync.
// Now: the active token is stored in `app_config` (rotatable without a
// redeploy), can be auto-refreshed via the Graph token-exchange endpoint, and
// its health (days remaining) is surfaced on the dashboard.
//
// Bootstrap/fallback: if nothing is stored yet, the env token is used and the
// optional INSTAGRAM_TOKEN_EXPIRES date drives the health readout.
// ============================================================================

const BASE = "https://graph.facebook.com/v21.0";
const TOKEN_KEY = "instagram_token";

interface StoredToken {
  token: string;
  expiresAt: string | null; // ISO
}

async function readConfig<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await getSupabase()
      .from("app_config")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    return data.value as T;
  } catch {
    return null;
  }
}

async function writeConfig(key: string, value: unknown): Promise<void> {
  const { error } = await getSupabase()
    .from("app_config")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`app_config write failed: ${error.message}`);
}

export interface ActiveToken {
  token: string;
  expiresAt: string | null;
  source: "db" | "env";
}

// DB-stored token wins (it can be rotated live); fall back to env for first run.
export async function getActiveToken(): Promise<ActiveToken | null> {
  const stored = await readConfig<StoredToken>(TOKEN_KEY);
  if (stored?.token) {
    return { token: stored.token, expiresAt: stored.expiresAt ?? null, source: "db" };
  }
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (envToken) {
    return { token: envToken, expiresAt: process.env.INSTAGRAM_TOKEN_EXPIRES || null, source: "env" };
  }
  return null;
}

export async function saveToken(token: string, expiresAt: string | null): Promise<void> {
  await writeConfig(TOKEN_KEY, { token, expiresAt });
}

export function canAutoRefresh(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export type TokenStatus = "ok" | "warn" | "expired" | "unknown";

export interface TokenHealth {
  status: TokenStatus;
  daysRemaining: number | null;
  expiresAt: string | null;
  source: "db" | "env" | "none";
  canAutoRefresh: boolean;
}

export async function getTokenHealth(): Promise<TokenHealth> {
  const active = await getActiveToken();
  const auto = canAutoRefresh();
  if (!active) {
    return { status: "unknown", daysRemaining: null, expiresAt: null, source: "none", canAutoRefresh: auto };
  }
  if (!active.expiresAt) {
    return { status: "unknown", daysRemaining: null, expiresAt: null, source: active.source, canAutoRefresh: auto };
  }
  const ms = new Date(active.expiresAt).getTime() - Date.now();
  const days = Math.floor(ms / 86_400_000);
  const status: TokenStatus = days < 0 ? "expired" : days < 7 ? "warn" : "ok";
  return { status, daysRemaining: days, expiresAt: active.expiresAt, source: active.source, canAutoRefresh: auto };
}

export interface RefreshResult {
  refreshed: boolean;
  expiresAt?: string;
  reason?: string;
}

// Exchange the current long-lived token for a fresh ~60-day one. Requires
// META_APP_ID + META_APP_SECRET. Never throws — returns a reason on failure so
// callers (the cron) can carry on with the existing token.
export async function refreshInstagramToken(): Promise<RefreshResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return { refreshed: false, reason: "missing_app_credentials" };

  const active = await getActiveToken();
  if (!active) return { refreshed: false, reason: "no_token" };

  try {
    const url =
      `${BASE}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${active.token}`;
    const res = await fetch(url);
    if (!res.ok) return { refreshed: false, reason: `http_${res.status}` };
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return { refreshed: false, reason: "no_access_token" };
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;
    await saveToken(data.access_token, expiresAt);
    return { refreshed: true, expiresAt: expiresAt ?? undefined };
  } catch (err) {
    return { refreshed: false, reason: err instanceof Error ? err.message : "error" };
  }
}
