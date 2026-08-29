import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { ensureSession, type CloudState } from "./client";
import { supabasePort } from "./port";
import { syncOnce } from "./sync";

/**
 * Keeps the device and the account in step. Local storage stays the source the
 * screens read, so nothing here can make the app slower or break it offline —
 * a failed sync just leaves the state exactly as it was.
 */
export function useCloud() {
  const { state, replaceAll, ready } = useStore();
  const [status, setStatus] = useState<CloudState>("connecting");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const running = useRef(false);
  // Read the freshest state at sync time without making it a hook dependency,
  // which would restart the sync on every keystroke.
  const latest = useRef(state);
  latest.current = state;

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const session = await ensureSession();
      if (!session.ok) {
        setStatus(session.reason);
        return;
      }
      const merged = await syncOnce(supabasePort, session.userId, latest.current);
      replaceAll(merged);
      setLastSync(new Date());
      setStatus("synced");
    } catch {
      setStatus("error");
    } finally {
      running.current = false;
    }
  }, [replaceAll]);

  // One sync per launch, after the local state has loaded — syncing before it
  // would push an empty state over a real account.
  useEffect(() => {
    if (!ready) return;
    void sync();
  }, [ready, sync]);

  return { status, lastSync, sync };
}
