/**
 * Web Push, with nothing but WebCrypto: the message encryption of RFC 8291
 * (aes128gcm) and the VAPID signature of RFC 8292. Kept free of Deno and of
 * any library so the same file is tested under Node against an independent
 * decryption (scripts/run-webpush-tests.mjs) and deployed to the edge as is.
 */

export type PushSubscription = { endpoint: string; p256dh: string; auth: string };

const enc = new TextEncoder();

export { buf as toArrayBuffer };

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The bytes as a plain ArrayBuffer — what WebCrypto and fetch are typed to take. */
function buf(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", buf(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: buf(salt), info: buf(info) }, key, bytes * 8);
  return new Uint8Array(bits);
}

/**
 * The body of one push message, encrypted for one subscription (RFC 8291):
 * a fresh key pair and salt per message, a single record, no padding.
 */
export async function encryptPayload(
  sub: Pick<PushSubscription, "p256dh" | "auth">,
  payload: Uint8Array,
  fixed?: { salt: Uint8Array; keys: CryptoKeyPair },
): Promise<Uint8Array> {
  const uaPublic = fromB64url(sub.p256dh);
  const authSecret = fromB64url(sub.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("bad subscription keys");

  const keys = fixed?.keys ?? (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", buf(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, keys.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  // The record: the payload, then the delimiter that says it is the last one.
  const plain = concat(payload, new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, aes, buf(plain)));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/** The VAPID key pair, from the private JWK kept as a function secret. */
export async function vapidKeys(privateJwk: JsonWebKey): Promise<{ signing: CryptoKey; publicKey: string }> {
  const signing = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const x = fromB64url(privateJwk.x ?? "");
  const y = fromB64url(privateJwk.y ?? "");
  if (x.length !== 32 || y.length !== 32) throw new Error("bad VAPID key");
  return { signing, publicKey: b64url(concat(new Uint8Array([4]), x, y)) };
}

/** The Authorization header for one push service (RFC 8292). */
export async function vapidHeader(
  endpoint: string,
  keys: { signing: CryptoKey; publicKey: string },
  subject: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(enc.encode(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: subject })));
  // WebCrypto signs ECDSA in the raw r||s form JWS wants — no DER to unwrap.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.signing, buf(enc.encode(`${head}.${body}`))),
  );
  return `vapid t=${head}.${body}.${b64url(sig)}, k=${keys.publicKey}`;
}

/** What a push service said: sent, gone for good (drop the subscription), or failed. */
export type PushOutcome = "sent" | "gone" | "failed";

export async function sendPush(
  sub: PushSubscription,
  payload: unknown,
  keys: { signing: CryptoKey; publicKey: string },
  subject: string,
  ttlSec = 3600,
): Promise<PushOutcome> {
  try {
    const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)));
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidHeader(sub.endpoint, keys, subject),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSec),
        Urgency: "normal",
      },
      body: buf(body),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
