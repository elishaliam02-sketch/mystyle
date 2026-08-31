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

async function secureGet(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  if (countRaw === null) return SecureStore.getItemAsync(key); // never chunked
  const n = Number(countRaw);
  let out = "";
  for (let i = 0; i < n; i++) out += (await SecureStore.getItemAsync(`${key}.${i}`)) ?? "";
  return out;
}

async function secureSet(key: string, value: string): Promise<void> {
  const chunks = Math.max(1, Math.ceil(value.length / CHUNK));
  await SecureStore.setItemAsync(`${key}.n`, String(chunks));
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
}

async function secureRemove(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  const n = countRaw ? Number(countRaw) : 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
  await SecureStore.deleteItemAsync(key);
}

/** The shape Supabase's auth storage expects. */
export const secureStorage = {
  getItem: (key: string) => (onWeb ? AsyncStorage.getItem(key) : secureGet(key)),
  setItem: (key: string, value: string) =>
    onWeb ? AsyncStorage.setItem(key, value) : secureSet(key, value),
  removeItem: (key: string) => (onWeb ? AsyncStorage.removeItem(key) : secureRemove(key)),
};
