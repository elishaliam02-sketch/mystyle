/**
 * Reading what the billing server says this account is entitled to.
 *
 * The phone never decides its own entitlement, it only repeats what the server
 * said — an entitlement the app can set is an entitlement anyone can set. So
 * this parser is the only door, and everything it does not recognise lands on
 * "we do not know" rather than on "pro".
 *
 * It is pure and knows nothing about the network, which is what lets the rule
 * be tested without a server, a session, or a card.
 */
export type ServerEntitlement = {
  status: "none" | "trialing" | "active" | "past_due" | "canceled" | "expired";
  plan?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
};

const STATUSES = ["none", "trialing", "active", "past_due", "canceled", "expired"] as const;

function isStatus(v: unknown): v is ServerEntitlement["status"] {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** Reads whatever the server returned into the shape the app stores, dropping
 * anything it does not recognise instead of trusting it. */
export function parseEntitlement(data: unknown): ServerEntitlement | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (!isStatus(row.status)) return null;
  return {
    status: row.status,
    plan: str(row.plan),
    currentPeriodEnd: str(row.currentPeriodEnd),
    trialEndsAt: str(row.trialEndsAt),
  };
}

