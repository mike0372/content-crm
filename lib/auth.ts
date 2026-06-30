// Edge-safe signed session token for the single-user gate.
//
// No "server-only" import: middleware (Edge runtime) verifies tokens here too.
// Uses Web Crypto (crypto.subtle), available in both the Edge and Node
// runtimes — so no Node 'crypto' dependency.

export const SESSION_COOKIE = "ap_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const payload = b64urlEncode(
    encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_S * 1000 }))
  );
  const sig = b64urlEncode(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(b64urlToBytes(sig), expected)) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))) as {
      exp?: number;
    };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
