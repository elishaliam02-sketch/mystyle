/**
 * Asking the billing server what this account is entitled to. The answer is
 * parsed by `@/billing/entitlement`, which is where the rules live; this file
 * is only the trip to the server and back.
 */
import { supabase } from "./client";
import { parseEntitlement, type ServerEntitlement } from "@/billing/entitlement";

export { parseEntitlement, type ServerEntitlement };

/**
 * Returns null when the answer is not known — offline, signed out, the function
 * not deployed, a malformed reply. A null must leave whatever is already stored
 * alone: overwriting a real subscription with "none" because the wifi dropped
 * would lock out someone who has paid.
 */
export async function fetchEntitlement(): Promise<ServerEntitlement | null> {
  try {
    const db = supabase();
    if (!db) return null;
    const { data: session } = await db.auth.getSession();
    if (!session.session) return null;
    const { data, error } = await db.functions.invoke("billing", { body: { action: "status" } });
    if (error) return null;
    return parseEntitlement(data);
  } catch {
    return null;
  }
}
