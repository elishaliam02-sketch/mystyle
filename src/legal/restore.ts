import { migrateState, type AppState } from "@/store/types";
import { LEGAL } from "./config";

/**
 * Reading back a file made by "download my data" — the way home for someone
 * who never turned cloud backup on and has a new phone, or cleared the site.
 *
 * The file is the person's own, but it is still a file: anything in it may
 * have been edited. So it is read through the same migration as stored state,
 * and what belongs to this device rather than to the person is kept as this
 * device has it — the consent records (evidence is only evidence where it was
 * given), the sync and backup cursors (another device's would skip or repeat
 * rows), the browser's reminder switch, and the paid status and usage counts,
 * which a file must not be able to raise.
 */

export type RestoreResult =
  | { ok: true; state: AppState; summary: { habits: number; days: number; exportedAt: string | null } }
  | { ok: false; reason: "notJson" | "notOurs" | "empty" };

export function readRestore(text: string, current: AppState): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "notJson" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "notOurs" };
  const { meta, data } = parsed as { meta?: { app?: unknown; exportedAt?: unknown }; data?: unknown };
  if (!meta || meta.app !== LEGAL.appName || !data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: "notOurs" };
  }

  const incoming = migrateState(data);
  const days = new Set<string>([
    ...incoming.completions.filter((c) => c.done).map((c) => c.date),
    ...Object.keys(incoming.intake ?? {}),
    ...incoming.weighIns.map((w) => w.date),
    ...incoming.checkIns.map((c) => c.date),
  ]);
  const habits = incoming.habits.filter((h) => !h.archived).length;
  if (habits === 0 && days.size === 0 && !incoming.training) return { ok: false, reason: "empty" };

  const high = Math.max(current.clockHighWaterMs ?? 0, incoming.clockHighWaterMs ?? 0);
  const state: AppState = {
    ...incoming,
    legal: current.legal,
    consent: current.consent,
    lastSyncAt: current.lastSyncAt,
    lastPushAt: current.lastPushAt,
    backupSig: current.backupSig,
    backupAt: current.backupAt,
    backupSeenAt: current.backupSeenAt,
    webPush: current.webPush,
    subscription: current.subscription,
    usage: current.usage,
    clockHighWaterMs: high > 0 ? high : undefined,
  };
  return {
    ok: true,
    state,
    summary: { habits, days: days.size, exportedAt: typeof meta.exportedAt === "string" ? meta.exportedAt : null },
  };
}
