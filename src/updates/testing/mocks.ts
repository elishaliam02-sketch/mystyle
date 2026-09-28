/**
 * Stand-ins for the native modules the updater talks to, driven by the test
 * (src/updates/updatestest.ts) through `globalThis.__upd`.
 */
type Ctl = {
  now: number;
  available: boolean;
  fetchMs: number;
  offline: boolean;
  fetchFail: boolean;
  focused: boolean;
  emergency: boolean;
  manifestId: string;
  reloads: number;
  checks: number;
  appState: string;
  store: Map<string, string>;
  listeners: ((s: string) => void)[];
};
const g = globalThis as unknown as { __upd: Ctl };
const c = () => g.__upd;

export const Updates = {
  isEnabled: true,
  get isEmergencyLaunch() {
    return c().emergency;
  },
  isEmbeddedLaunch: false,
  updateId: "running",
  channel: "preview",
  runtimeVersion: "0.1.0",
  async checkForUpdateAsync() {
    c().checks++;
    if (c().offline) throw new Error("offline");
    return { isAvailable: c().available };
  },
  createdAt: null,
  async fetchUpdateAsync() {
    c().now += c().fetchMs;
    if (c().fetchFail) throw new Error("Failed to download asset");
    return { isNew: true, manifest: { id: c().manifestId } };
  },
  async reloadAsync() {
    c().reloads++;
  },
};

export const ReactNative = {
  Platform: { OS: "android" },
  AppState: {
    get currentState() {
      return c().appState;
    },
    addEventListener(_: string, fn: (s: string) => void) {
      c().listeners.push(fn);
      return { remove() {} };
    },
  },
  TextInput: { State: { currentlyFocusedInput: () => (c().focused ? {} : null) } },
};

export const AsyncStorage = {
  async getItem(k: string) {
    return c().store.get(k) ?? null;
  },
  async setItem(k: string, v: string) {
    c().store.set(k, v);
  },
};
