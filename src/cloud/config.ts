/**
 * Where the app's data lives. Both values are meant to be public — the
 * publishable key only ever grants what row level security allows, and every
 * table's policy restricts rows to the signed-in user.
 *
 * The real secret (the service role key) never appears in this app; anything
 * needing it belongs on a server.
 */
export const SUPABASE_URL = "https://vesdfboxetdwymsulpsc.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QJJEFeAVnwdJDwdVpOHjFA_un6l0Of_";

/** False when the project has not been configured — the app then stays local. */
export const cloudConfigured =
  SUPABASE_URL.startsWith("https://") && SUPABASE_PUBLISHABLE_KEY.length > 10;
