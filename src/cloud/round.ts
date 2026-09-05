/**
 * One safe sync round.
 *
 * A sync is several seconds of network, and everything it produces is computed
 * from the state as it was when the round *started*. Writing that result back
 * unconditionally is a data-loss bug: if the person changed anything while the
 * round was in flight — switched goal, edited the plan, logged a meal — the
 * write replaces their change with a snapshot that predates it, and the app
 * appears to simply ignore what they did.
 *
 * So a round commits only when the state it was computed from is still the
 * state in hand. Otherwise it is dropped and the caller goes round again; the
 * person's edit is always the newer truth and always wins.
 *
 * Kept pure and injectable so the race is testable without a network or React.
 */
export type RoundResult = "committed" | "dropped";

export async function syncRound<S>(opts: {
  /** Reads the freshest state, both before and after the work. */
  read: () => S;
  /** The network round, computed from the snapshot it is handed. */
  work: (snapshot: S) => Promise<S>;
  /** Writes the result back. Called only when it is safe to do so. */
  commit: (next: S) => void;
}): Promise<RoundResult> {
  const snapshot = opts.read();
  const next = await opts.work(snapshot);
  // The person edited while we were on the network — their change is newer than
  // anything this round computed, so keep it and let the caller retry.
  if (opts.read() !== snapshot) return "dropped";
  opts.commit(next);
  return "committed";
}
