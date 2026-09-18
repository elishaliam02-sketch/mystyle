import { buildAuditEvent, isAdminAction, isAuditKind, isSensitiveKey } from "./audit";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const NOW = "2026-09-18T12:00:00.000Z";

// Known kinds pass, invented ones do not.
check("a known kind is accepted", isAuditKind("auth.signin"));
check("an invented kind is rejected", !isAuditKind("auth.superuser"));
check("a non-string kind is rejected", !isAuditKind(42));

// A plain event is built.
{
  const e = buildAuditEvent({ kind: "auth.signin", actorId: "u1" }, NOW);
  check("a valid event is built", e !== null && e.kind === "auth.signin" && e.actorId === "u1", JSON.stringify(e));
  check("the timestamp is the now it was handed", e?.at === NOW);
}

// An unknown kind is dropped, not thrown.
check("an unknown kind builds nothing", buildAuditEvent({ kind: "nope", actorId: "u1" }, NOW) === null);

// A broken clock drops the event rather than storing a bad time.
check("an unparseable now builds nothing",
  buildAuditEvent({ kind: "auth.signin", actorId: "u1" }, "not-a-date") === null);

// System events have a null actor.
{
  const e = buildAuditEvent({ kind: "invoice.issued", actorId: null, meta: { number: "2026-0001" } }, NOW);
  check("a system event has a null actor", e?.actorId === null, JSON.stringify(e));
  check("its safe meta survives", e?.meta?.number === "2026-0001");
}

// THE important one: secrets never reach the log, whatever their value.
{
  const e = buildAuditEvent(
    {
      kind: "auth.signin",
      actorId: "u1",
      meta: {
        email: "liam@example.com",
        password: "hunter2",
        access_token: "eyJhbGci...",
        api_key: "sk_live_abc",
        card: "4242424242424242",
        sessionId: "sess_123",
        plan: "yearly",
        attempts: 3,
        remembered: true,
      },
    },
    NOW,
  );
  check("a non-sensitive field is kept", e?.meta?.email === "liam@example.com", JSON.stringify(e?.meta));
  check("a plan and count and flag are kept", e?.meta?.plan === "yearly" && e?.meta?.attempts === 3 && e?.meta?.remembered === true);
  for (const secret of ["password", "access_token", "api_key", "card", "sessionId"]) {
    check(`the secret-looking key '${secret}' is dropped`, e?.meta?.[secret] === undefined, JSON.stringify(e?.meta));
  }
}

// The sensitivity test catches near-misses.
check("password, token, secret, key, cvv, otp all read as sensitive",
  ["password", "refresh_token", "client_secret", "stripe_key", "cvv", "otp_code", "authHeader"].every(isSensitiveKey));
check("an ordinary field is not sensitive",
  !isSensitiveKey("email") && !isSensitiveKey("plan") && !isSensitiveKey("count"));

// Non-primitive meta values are dropped.
{
  const e = buildAuditEvent(
    { kind: "admin.view_user", actorId: "admin", targetId: "u9",
      meta: { note: "looked", nested: { a: 1 } as never, list: [1, 2] as never, bad: NaN as never } },
    NOW,
  );
  check("target id is carried for an admin action", e?.targetId === "u9", JSON.stringify(e));
  check("only the flat string survives", e?.meta?.note === "looked" && e?.meta?.nested === undefined && e?.meta?.list === undefined && e?.meta?.bad === undefined, JSON.stringify(e?.meta));
}

// Meta that reduces to nothing leaves no empty object behind.
{
  const e = buildAuditEvent({ kind: "auth.signout", actorId: "u1", meta: { token: "x" } }, NOW);
  check("meta with only secrets becomes absent", e?.meta === undefined, JSON.stringify(e));
}

// Admin actions are flagged as such.
check("admin.* is an admin action", isAdminAction("admin.refund") && isAdminAction("admin.ban"));
check("a customer's own event is not an admin action", !isAdminAction("auth.signin") && !isAdminAction("billing.subscribed"));

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
