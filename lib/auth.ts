// Single-user auth core. Runs in BOTH the Edge runtime (middleware) and the
// Node runtime (API routes), so it uses Web Crypto (globalThis.crypto.subtle)
// only — no Node `crypto` import.
//
// The session cookie is NOT the secret. It is a signed token:
//   base64url(JSON{exp}) + "." + base64url(HMAC-SHA256(payload, AUTH_SECRET))
// The payload carries an absolute expiry (`exp`, ms epoch). The token cannot be
// forged without AUTH_SECRET, and it cannot be replayed past `exp`. The window
// is short (3h) and refreshed on activity (see middleware), so leaving the app
// idle for 3h disconnects you.

export const SESSION_COOKIE = "ap_session";
export const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Constant-time string compare — no early return on first mismatch.
export function safeEqual(a: string, b: string): boolean {
  // XOR length into the diff so unequal lengths still run a full pass.
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

// Mint a fresh session token valid for SESSION_TTL_MS from now.
export async function signSession(secret: string, ttlMs = SESSION_TTL_MS): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify({ exp: Date.now() + ttlMs })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

// Verify signature + expiry. Returns the payload's exp, or null if invalid.
export async function verifySession(secret: string, token: string | undefined): Promise<{ exp: number } | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = await hmac(secret, payload);
  if (!safeEqual(sig, expected)) return null;

  try {
    const obj = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { exp?: number };
    if (typeof obj.exp !== "number" || obj.exp <= Date.now()) return null;
    return { exp: obj.exp };
  } catch {
    return null;
  }
}
