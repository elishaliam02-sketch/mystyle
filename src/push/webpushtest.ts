/**
 * Tests for the server's Web Push code (supabase/functions/_shared/webpush.ts),
 * run under Node's WebCrypto. The encryption is checked byte for byte against
 * the worked example in RFC 8291 §5, and the VAPID header by verifying its
 * signature with the public key it carries.
 */
import { b64url, encryptPayload, fromB64url, toArrayBuffer as buf, vapidHeader, vapidKeys } from "../../supabase/functions/_shared/webpush";

const results: [string, boolean, string?][] = [];
const check = (name: string, pass: boolean, detail?: string) => results.push([name, pass, detail]);

// RFC 8291 §5 — the example message, keys and salt.
const PLAINTEXT = "When I grow up, I want to be a watermelon";
const AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
const AS_PUBLIC = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
const UA_PUBLIC = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
const SALT = "DGv6ra1nlYgDCS1FRnbzlw";
const EXPECTED =
  "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

async function asKeys(): Promise<CryptoKeyPair> {
  const pub = fromB64url(AS_PUBLIC);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: AS_PRIVATE,
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
    ext: true,
  };
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = await crypto.subtle.importKey("raw", buf(pub), { name: "ECDH", namedCurve: "P-256" }, true, []);
  return { privateKey, publicKey };
}

async function main() {
  const body = await encryptPayload(
    { p256dh: UA_PUBLIC, auth: AUTH },
    new TextEncoder().encode(PLAINTEXT),
    { salt: fromB64url(SALT), keys: await asKeys() },
  );
  check("the RFC 8291 example encrypts to exactly the published bytes", b64url(body) === EXPECTED, b64url(body));
  check("the header carries the salt, a 4096 record size and the sender's key",
    b64url(body.slice(0, 16)) === SALT && new DataView(body.buffer).getUint32(16) === 4096 && body[20] === 65);

  const fresh = await encryptPayload({ p256dh: UA_PUBLIC, auth: AUTH }, new TextEncoder().encode("{}"));
  const again = await encryptPayload({ p256dh: UA_PUBLIC, auth: AUTH }, new TextEncoder().encode("{}"));
  check("every message gets its own salt and key", b64url(fresh.slice(0, 16)) !== b64url(again.slice(0, 16)));
  let refused = false;
  try {
    await encryptPayload({ p256dh: "AAAA", auth: AUTH }, new Uint8Array(1));
  } catch {
    refused = true;
  }
  check("a malformed subscription key is refused", refused);

  // VAPID: a fresh key, the header it makes, and that the signature verifies.
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const keys = await vapidKeys(jwk);
  check("the public key is the 65-byte uncompressed point", fromB64url(keys.publicKey).length === 65 && fromB64url(keys.publicKey)[0] === 4);
  const header = await vapidHeader("https://web.push.apple.com/QGuQyavXutnMm", keys, "https://mystyle.expo.app", 1_800_000_000);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
  check("the header has the vapid form", !!m, header.slice(0, 40));
  if (m) {
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(m[2]!)));
    check("the audience is the push service's origin", claims.aud === "https://web.push.apple.com", claims.aud);
    check("it expires within a day", claims.exp === 1_800_000_000 + 12 * 3600);
    check("it names who sends", claims.sub === "https://mystyle.expo.app");
    check("k is the public key", m[4] === keys.publicKey);
    const pub = await crypto.subtle.importKey("raw", buf(fromB64url(m[4]!)), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      buf(fromB64url(m[3]!)),
      buf(new TextEncoder().encode(`${m[1]}.${m[2]}`)),
    );
    check("the signature verifies with that key", ok);
  }

  const failed = results.filter(([, ok]) => !ok);
  for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ← ${detail ?? ""}`}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

await main();
