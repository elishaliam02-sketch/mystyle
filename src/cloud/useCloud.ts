import { useCallback, useEffect, useRef, useState } from "react";
import { AppState as RNAppState } from "react-native";
import { useStore, type AppState } from "@/store";
import { ensureSession, type CloudState } from "./client";
import { supabasePort } from "./port";
import { syncOnce } from "./sync";

/**
 * Keeps the device and the account in step. Local storage stays the source the
 * screens read, so nothing here can make the app slower or break it offline —
 * a failed sync just leaves the state exactly as it was.
 */
export function useCloud() {
  const { state, replaceAll, ready, noteServerTime } = useStore();
  const [status, setStatus] = useState<CloudState>("connecting");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const running = useRef(false);
  // Read the freshest state at sync time without making it a hook dependency,
  // which would restart the sync on every keystroke.
  const latest = useRef(state);
  latest.current = state;
  // The exact object the last sync handed back. A sync ends by replacing the
  // state, so without this the change it made would schedule another sync,
  // and the app would talk to the server every four seconds forever.
  const ourOwnWrite = useRef<AppState | null>(null);

  const sync = useCallback(async () => {
    // One at a time. Two syncs in flight would each merge against a state the
    // other is about to replace, and the slower one would win.
    if (running.current) return;
    running.current = true;
    try {
      const session = await ensureSession();
      if (!session.ok) {
        setStatus(session.reason);
        return;
      }
      const merged = await syncOnce(supabasePort, session.userId, latest.current);
      ourOwnWrite.current = merged;
      replaceAll(merged);
      // lastSyncAt is the server's own clock (server_now), so it is the trusted
      // time that hardens the anti-cheat clock guard.
      if (merged.lastSyncAt) noteServerTime(merged.lastSyncAt);
      setLastSync(new Date());
      setStatus("synced");
    } catch {
      setStatus("error");
    } finally {
      running.current = false;
    }
  }, [replaceAll]);

  // One sync on launch, after the local state has loaded — syncing before it
  // would push an empty state over a real account.
  useEffect(() => {
    if (!ready) return;
    void sync();
  }, [ready, sync]);

  // Then again shortly after the user changes anything. Waiting for the next
  // launch to save a tick is how a reinstalled phone loses a week; a few
  // seconds of quiet is enough to batch a burst of ticking into one round.
  useEffect(() => {
    if (!ready) return;
    if (state === ourOwnWrite.current) return;
    const timer = setTimeout(() => void sync(), 4000);
    return () => clearTimeout(timer);
  }, [ready, sync, state]);

  // And when the app comes back to the foreground, which is the moment another
  // device's changes are most likely to be waiting.
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", (next) => {
      if (next === "active") void sync();
    });
    return () => sub.remove();
  }, [sync]);

  return { status, lastSync, sync };
}
