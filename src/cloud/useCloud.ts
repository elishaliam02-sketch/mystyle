import { useCallback, useEffect, useRef, useState } from "react";
import { AppState as RNAppState } from "react-native";
import { useStore, type AppState } from "@/store";
import { currentAccount, ensureSession, type AccountInfo, type CloudState } from "./client";
import { supabasePort } from "./port";
import { syncOnce } from "./sync";
import {
  applyBackup,
  backupBundle,
  backupSignature,
  decideBackup,
  isEmptyBackup,
} from "./backup";
import { pullBackup, pushBackup } from "./backupPort";
import { syncRound } from "./round";
import { fetchEntitlement } from "./entitlementPort";

const nowIso = () => new Date().toISOString();

/**
 * Keeps the device and the account in step. Local storage stays the source the
 * screens read, so nothing here can make the app slower or break it offline —
 * a failed sync just leaves the state exactly as it was.
 */
export function useCloud() {
  const { state, replaceAll, ready, noteServerTime, consent, setSubscription } = useStore();
  // Nothing reaches the network until the person has said it may. This is the
  // one gate: the sync itself, the account, and the backup all hang off it, so
  // there is no second path that could quietly keep uploading after someone
  // turned it off.
  const allowed = consent().cloud;
  const [status, setStatus] = useState<CloudState>("connecting");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const running = useRef(false);
  // Read the freshest state at sync time without making it a hook dependency,
  // which would restart the sync on every keystroke.
  const latest = useRef(state);
  latest.current = state;
  // The exact object the last sync handed back. A sync ends by replacing the
  // state, so without this the change it made would schedule another sync,
  // and the app would talk to the server every four seconds forever.
  const ourOwnWrite = useRef<AppState | null>(null);
  // Set when a round was thrown away because the person edited mid-flight, so
  // the moment the lock is free we go again and their change reaches the server.
  const resync = useRef(false);

  const sync = useCallback(async () => {
    if (!allowed) {
      // Not an error and not worth a warning: the app is doing exactly what it
      // was told, and every screen works the same way offline.
      setStatus("local");
      return;
    }
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
      // The round commits only if the person did not change anything while it
      // was in flight. If they did, their edit is the newer truth and this
      // round's result — computed from a state that no longer exists — is
      // dropped rather than written over it. Writing it back unconditionally is
      // what made the app look like it never updates: change the goal, a sync
      // that started moments earlier lands, and the change is silently undone.
      const outcome = await syncRound<AppState>({
        read: () => latest.current,
        work: async (snapshot) => {
          const merged = await syncOnce(supabasePort, session.userId, snapshot);
          // Then the full-state backup: everything the granular sync does not
          // carry (workouts, food, water, steps, measurements, goals) as one
          // blob, so a reinstalled or new phone gets it all back.
          return runBackup(session.userId, merged);
        },
        commit: (withBackup) => {
          ourOwnWrite.current = withBackup;
          replaceAll(withBackup);
          // lastSyncAt is the server's own clock (server_now), so it is the
          // trusted time that hardens the anti-cheat clock guard.
          if (withBackup.lastSyncAt) noteServerTime(withBackup.lastSyncAt);
          void currentAccount().then(setAccount);
        },
      });

      // A dropped round still has to reach the server — go again once free.
      if (outcome === "dropped") resync.current = true;
      setLastSync(new Date());
      setStatus("synced");

      // What the account is entitled to, refreshed on the same round. It has to
      // ride along with the sync rather than wait for someone to open the
      // pricing screen: a person who subscribed on another device, or whose
      // card was declined last night, would otherwise carry yesterday's answer
      // until they happened to go looking for it. A null means "not known" and
      // deliberately leaves whatever is stored alone.
      const ent = await fetchEntitlement();
      if (ent) setSubscription(ent);
    } catch {
      setStatus("error");
    } finally {
      running.current = false;
      // A round we dropped to protect a mid-flight edit still needs to reach the
      // server. Go again once the lock is free, on a short delay so a burst of
      // taps settles into one round rather than a request per tap.
      if (resync.current) {
        resync.current = false;
        setTimeout(() => void sync(), 1500);
      }
    }
    // `allowed` belongs here: turning cloud backup off has to stop the very
    // next round, not the next launch, and turning it on has to start one
    // without waiting for something else to change.
  }, [replaceAll, allowed, setSubscription]);

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

  return { status, lastSync, account, refreshAccount: () => void currentAccount().then(setAccount), sync };
}

/**
 * One backup round: decide whether to upload the device's data or restore the
 * account's, then apply the bookkeeping so the next round knows what it last
 * saw. Never throws — a failed backup leaves the merged state untouched.
 */
async function runBackup(userId: string, merged: AppState): Promise<AppState> {
  try {
    const local = backupBundle(merged);
    const sig = backupSignature(local);
    const remote = await pullBackup(userId);

    // When did this device's backup data last change? If the data is unchanged
    // since the last round, keep the old stamp; if it changed, it changed now.
    // An empty (fresh-install) bundle is treated as never-changed, so a blank
    // phone restores the account instead of claiming its data is newest.
    const localChangedAt = isEmptyBackup(local)
      ? "1970-01-01T00:00:00.000Z"
      : sig !== merged.backupSig
        ? nowIso()
        : merged.backupAt ?? nowIso();

    const decision = decideBackup({ local, localChangedAt, remote, lastSeenAt: merged.backupSeenAt });

    if (decision.action === "restore") {
      const restored = applyBackup(merged, decision.bundle);
      return {
        ...restored,
        backupSig: backupSignature(decision.bundle),
        backupAt: remote!.at,
        backupSeenAt: remote!.at,
      };
    }
    if (decision.action === "upload") {
      const at = await pushBackup(userId, decision.bundle, decision.at);
      if (!at) return merged; // server refused; try again next round
      return { ...merged, backupSig: sig, backupAt: at, backupSeenAt: at };
    }
    // nothing to do — just remember the signature so we don't re-detect a change
    return { ...merged, backupSig: sig };
  } catch {
    return merged;
  }
}
