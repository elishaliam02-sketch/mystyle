/** A stand-in for expo-secure-store in securestoragetest.ts: an in-memory map
 * that can be told to fail after N writes, to play a crash mid-write. */
export const store = new Map<string, string>();
export const ctl = { failAfter: Infinity, writes: 0 };
export const getItemAsync = async (k: string) => store.get(k) ?? null;
export const setItemAsync = async (k: string, v: string) => {
  if (++ctl.writes > ctl.failAfter) throw new Error("crash");
  store.set(k, v);
};
export const deleteItemAsync = async (k: string) => {
  store.delete(k);
};
