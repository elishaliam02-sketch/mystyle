/**
 * A clock the user cannot wind back.
 *
 * Streaks and "today" must not be forgeable by changing the phone's date. Full
 * protection lives on the server — the real streak is computed from server
 * timestamps, never trusted from the device (see the security notes). This is
 * the client half: it stops the cheap, common cheat of rewinding the clock to
 * re-do a day, and flags a device whose time disagrees badly with the server.
 *
 * The lever is a high-water mark: the furthest point in time the app has ever
 * seen. Time only ever moves forward past it. If the device clock is set back,
 * the app keeps using the high-water instant, so a "fresh" yesterday cannot be
 * manufactured. Moving the clock forward while offline is the one case the
 * client cannot settle alone; the server reconciles it on the next sync.
 *
 * Pure and dependency-free, so it tests without a device.
 */

/** The instant to treat as now: the device clock, but never behind the mark. */
export function trustedNowMs(deviceMs: number, highWaterMs = 0): number {
  return Math.max(deviceMs, highWaterMs);
}

/** The new high-water after observing a device instant. Only ever grows. */
export function advanceHighWater(highWaterMs: number, deviceMs: number): number {
  return Math.max(highWaterMs, deviceMs);
}

/** Local calendar date (YYYY-MM-DD) for an instant — never UTC. */
export function toLocalDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when the device clock is far enough from the server's to distrust it. */
export function clockSuspect(
  deviceMs: number,
  serverMs: number,
  toleranceMs = 12 * 60 * 60 * 1000,
): boolean {
  return Math.abs(deviceMs - serverMs) > toleranceMs;
}
