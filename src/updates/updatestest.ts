/**
 * The automatic updater: an update installs by itself when the app is opened,
 * waits when it would interrupt, and never loops on one that cannot start.
 * Runs with `npm run test:updates` (scripts/run-updates-tests.mjs).
 */
type Mod = typeof import("./index");
const g = globalThis as unknown as { __loadUpdates: () => Mod; __upd: Record<string, unknown> };

const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push([name, ok, detail]);

function fresh(over: Record<string, unknown> = {}) {
  const ctl = {
    now: 1_000_000,
    available: true,
    fetchMs: 2_000,
    offline: false,
    focused: false,
    emergency: false,
    manifestId: "u1",
    reloads: 0,
    checks: 0,
    appState: "active",
    store: new Map<string, string>(),
    listeners: [] as ((s: string) => void)[],
    ...over,
  };
  g.__upd = ctl;
  Date.now = () => ctl.now;
  return { ctl, mod: g.__loadUpdates() };
}

(async () => {
  {
    const { ctl, mod } = fresh();
    const s = await mod.checkAndApply("launch");
    check("an update that downloads quickly at launch installs by itself", s === "ready" && ctl.reloads === 1, `${s} reloads=${ctl.reloads}`);
  }
  {
    const { ctl, mod } = fresh({ available: false });
    const s = await mod.checkAndApply("launch");
    check("nothing new: no restart", s === "current" && ctl.reloads === 0);
  }
  {
    const { ctl, mod } = fresh({ fetchMs: 40_000 });
    await mod.checkAndApply("launch");
    check("a slow download does not restart the app mid-use", ctl.reloads === 0);
    ctl.now += 5 * 60_000;
    await mod.checkAndApply("resume");
    check("it installs the next time the app is opened", ctl.reloads === 1, `reloads=${ctl.reloads}`);
  }
  {
    const { ctl, mod } = fresh({ focused: true });
    await mod.checkAndApply("launch");
    check("never while the keyboard is up", ctl.reloads === 0);
    ctl.focused = false;
    ctl.now += 60_000;
    await mod.checkAndApply("resume");
    check("and installs once it is down", ctl.reloads === 1);
  }
  {
    const { ctl, mod } = fresh({ offline: true });
    const s = await mod.checkAndApply("launch");
    check("offline is quiet: no error, no restart", s === "failed" && ctl.reloads === 0);
  }
  {
    const { ctl, mod } = fresh({ available: false });
    await mod.checkAndApply("launch");
    ctl.now += 10_000;
    await mod.checkAndApply("resume");
    check("returning within a minute does not ask the server again", ctl.checks === 1, `checks=${ctl.checks}`);
    ctl.now += 61_000;
    ctl.available = true;
    await mod.checkAndApply("resume");
    check("after a minute it asks again, and installs what it finds", ctl.checks === 2 && ctl.reloads === 1, `checks=${ctl.checks} reloads=${ctl.reloads}`);
  }
  {
    // An update that could not start: the phone keeps coming back up on the
    // old version and the server keeps offering the same one.
    const store = new Map<string, string>();
    let reloads = 0;
    for (let i = 0; i < 4; i++) {
      const { ctl, mod } = fresh({ store });
      await mod.checkAndApply("launch");
      reloads += ctl.reloads;
    }
    check("an update that cannot start is tried twice, not forever", reloads === 2, `reloads=${reloads}`);
    const { ctl, mod } = fresh({ store, manifestId: "u2" });
    await mod.checkAndApply("launch");
    check("the next update installs normally", ctl.reloads === 1);
  }
  {
    const { ctl, mod } = fresh({ emergency: true });
    await mod.checkAndApply("launch");
    check("no automatic restart after an emergency fallback", ctl.reloads === 0);
  }
  {
    const { ctl, mod } = fresh({ fetchMs: 40_000 });
    await mod.checkAndApply("manual");
    check("asking by hand installs even a slow download", ctl.reloads === 1);
  }
  {
    const { ctl, mod } = fresh({ appState: "background" });
    await mod.checkAndApply("launch");
    check("never restarts while the app is in the background", ctl.reloads === 0);
  }

  const failed = results.filter(([, ok]) => !ok);
  for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
})();
