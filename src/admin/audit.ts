/**
 * The shape of the audit trail — what gets written down when something that
 * matters happens, and the guarantee that a secret never gets written down with
 * it.
 *
 * An audit log is only worth keeping if it can be trusted, and the fastest way
 * to poison one is to let a password, a token or a card number ride along in
 * the "details" of an event. So the ONE job of this pure module is to build a
 * normalised event from whatever a caller hands it, and to refuse — silently
 * and by construction — to carry anything that looks like a credential.
 *
 * Pure: the actual insert happens server-side (the client can emit a login
 * event, the billing function emits payment events), but every one of them goes
 * through here first, so the redaction rule lives in exactly one place and is
 * tested once.
 */

/** The events APEX records. A closed set: anything not on this list is dropped
 * rather than written, so the log cannot be stuffed with invented kinds. */
export const AUDIT_KINDS = [
  "auth.signup",
  "auth.signin",
  "auth.signout",
  "auth.reset_requested",
  "auth.account_deleted",
  "billing.checkout_started",
  "billing.subscribed",
  "billing.trial_started",
  "billing.canceled",
  "billing.payment_failed",
  "invoice.issued",
  "admin.login",
  "admin.view_user",
  "admin.comp_trial",
  "admin.refund",
  "admin.ban",
  "admin.delete_user",
] as const;

export type AuditKind = (typeof AUDIT_KINDS)[number];

export function isAuditKind(v: unknown): v is AuditKind {
  return typeof v === "string" && (AUDIT_KINDS as readonly string[]).includes(v);
}

export type AuditMeta = Record<string, string | number | boolean>;

export type AuditEvent = {
  kind: AuditKind;
  /** ISO instant the event happened. */
  at: string;
  /** Who caused it — a user id, or null for a system/webhook event. */
  actorId: string | null;
  /** Whom it was about, when that differs from the actor (admin acting on a
   * user). Absent otherwise. */
  targetId?: string;
  /** Extra context, already stripped of anything sensitive. */
  meta?: AuditMeta;
};

/** Keys whose VALUE must never be recorded, matched loosely so a near-miss name
 * is still caught. The test is the spec here. */
const SENSITIVE = /pass|secret|token|key|auth|card|cvv|cvc|ssn|pin|otp|session/i;

const MAX_META_KEYS = 20;
const MAX_STRING = 500;

/** True when a meta key must be dropped because its value could be a secret. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE.test(key);
}

function cleanMeta(meta: unknown): AuditMeta | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const out: AuditMeta = {};
  let n = 0;
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (n >= MAX_META_KEYS) break;
    if (isSensitiveKey(k)) continue; // never record, whatever the value is
    if (typeof v === "string") {
      out[k] = v.length > MAX_STRING ? v.slice(0, MAX_STRING) : v;
      n += 1;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
      n += 1;
    } else if (typeof v === "boolean") {
      out[k] = v;
      n += 1;
    }
    // Objects, arrays, functions, NaN: dropped. The log carries flat facts only.
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Build a normalised audit event, or null if it cannot be trusted enough to
 * store. Returning null (rather than throwing) means an unknown kind or a
 * broken timestamp is quietly not logged instead of taking down the path that
 * tried to log it — an audit write must never break the thing it is auditing.
 */
export function buildAuditEvent(
  input: {
    kind: unknown;
    actorId?: string | null;
    targetId?: string | null;
    meta?: unknown;
  },
  nowIso: string,
): AuditEvent | null {
  if (!isAuditKind(input.kind)) return null;
  if (!Number.isFinite(Date.parse(nowIso))) return null;

  const event: AuditEvent = {
    kind: input.kind,
    at: nowIso,
    actorId: typeof input.actorId === "string" && input.actorId ? input.actorId : null,
  };
  if (typeof input.targetId === "string" && input.targetId) event.targetId = input.targetId;
  const meta = cleanMeta(input.meta);
  if (meta) event.meta = meta;
  return event;
}

/** Whether an event is an administrative action (as opposed to a customer's own
 * activity). The dashboard highlights these, because they are the ones a person
 * with power did to someone else. */
export function isAdminAction(kind: AuditKind): boolean {
  return kind.startsWith("admin.");
}
