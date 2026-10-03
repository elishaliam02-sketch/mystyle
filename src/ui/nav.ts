import type { useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Leaves a pushed screen: back where there is somewhere to go back to, home
 * otherwise. A screen opened from a link, or reloaded in the browser, has no
 * history inside the app — a bare back() then did nothing on a phone, and on
 * the web went back out of the site altogether.
 */
export function leave(router: Router, fallback: "/" = "/"): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
