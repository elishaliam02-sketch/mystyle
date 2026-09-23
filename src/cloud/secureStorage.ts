import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Where the Supabase session lives, encrypted at rest.
 *
 * The session is the one genuinely sensitive thing on the device: hold it and
 * you are the user. AsyncStorage keeps it in plain files, readable on a rooted
 * phone or a device backup. This keeps it in the platform keystore instead —
 * the iOS Keychain and the Android Keystore — which is hardware-backed and
 * encrypted, and which other apps cannot read.
 *
 * The keystore caps a value at roughly two kilobytes, and a session (two JWTs)
 * can exceed that, so a long value is split into chunks with a small count
 * record. On the web there is no keystore, so it falls back to the browser's
 * own storage, which is already origin-isolated.
 */
const CHUNK = 1800;
const onWeb = Platform.OS === "web";

/**
 * Where a key's chunks live, read from its pointer `<key>.n`: "a:3" / "b:3"
 * (slot and count), or a bare "3" from before slots existed. A write goes to
 * the slot not in use and then flips the pointer in one call, so a crash
 * mid-write leaves the previous session whole rather than a mix of old and new
 * chunks — an anonymous account whose session is corrupted cannot be signed
 * back into, and its data is unreachable.
 */
type Layout = { prefix: string; count: number; slot: "a" | "b" | null };

async function layoutOf(key: string): Promise<Layout | null> {
  const raw = await SecureStore.getItemAsync(`${key}.n`);
  if (raw === null) return null;
  const m = /^([ab]):(\d+)$/.exec(raw);
  if (m) return { prefix: `${key}.${m[1]}.`, count: Number(m[2]), slot: m[1] as "a" | "b" };
  return { prefix: `${key}.`, count: Number(raw) || 0, slot: null };
}

async function secureGet(key: string): Promise<string | null> {
  const layout = await layoutOf(key);
  if (!layout) return SecureStore.getItemAsync(key); // never chunked
  let out = "";
  for (let i = 0; i < layout.count; i++) out += (await SecureStore.getItemAsync(`${layout.prefix}${i}`)) ?? "";
  return out;
}

async function secureSet(key: string, value: string): Promise<void> {
  const old = await layoutOf(key);
  const slot = old?.slot === "a" ? "b" : "a";
  const chunks = Math.max(1, Math.ceil(value.length / CHUNK));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(`${key}.${slot}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await SecureStore.setItemAsync(`${key}.n`, `${slot}:${chunks}`);
  if (old) for (let i = 0; i < old.count; i++) await SecureStore.deleteItemAsync(`${old.prefix}${i}`);
}

async function secureRemove(key: string): Promise<void> {
  const layout = await layoutOf(key);
  if (layout) for (let i = 0; i < layout.count; i++) await SecureStore.deleteItemAsync(`${layout.prefix}${i}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = {
  getItem: (key: string) => (onWeb ? AsyncStorage.getItem(key) : secureGet(key)),
  setItem: (key: string, value: string) =>
    onWeb ? AsyncStorage.setItem(key, value) : secureSet(key, value),
  removeItem: (key: string) => (onWeb ? AsyncStorage.removeItem(key) : secureRemove(key)),
};
