/**
 * The two Content-Security-Policies stay true to what they protect.
 *
 * Web app (public/index.html): every host the app loads an image from or talks
 * to must be allowed, or the feature silently breaks on web; the e2e suite
 * catches refusals it happens to trigger, this catches the ones it does not.
 *
 * Admin console (admin/index.html): its inline script runs only because the
 * policy names its hash, and supabase-js loads only because its integrity
 * hash matches. Edit the script or bump the library and both go stale — the
 * page then shows nothing at all. This prints the new values to paste.
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const out = path.resolve("node_modules/.cache/csphosts.mjs");
await build({
  stdin: {
    contents: `
      export { SUPABASE_URL } from "@/cloud/config";
      export { PHOTO_HOSTS } from "@/kitchen/photo";
      export { FOOD_FACTS_HOSTS } from "@/kitchen/foodfacts";
      export { EXERCISE_IMAGE } from "@/workout/images";
      export { LEGAL } from "@/legal/config";`,
    resolveDir: path.resolve("."),
    loader: "ts",
  },
  bundle: true, format: "esm", platform: "node", outfile: out,
  alias: { "@": path.resolve("src") }, logLevel: "warning",
  // Only the constants are wanted; anything native stays out of the bundle.
  external: ["react-native", "expo-*", "@react-native-async-storage/*", "react"],
});
const { SUPABASE_URL, PHOTO_HOSTS, FOOD_FACTS_HOSTS, EXERCISE_IMAGE } = await import(pathToFileURL(out).href);

const results = [];
const check = (n, p, d) => results.push([n, !!p, d]);

/** directive -> sources, from a policy string. */
function parsePolicy(policy) {
  const map = new Map();
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) map.set(name, sources);
  }
  return map;
}
function policyIn(html) {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html);
  return m ? parsePolicy(m[1]) : null;
}
/** Does one of these CSP sources allow this URL? Host sources and path-prefix sources only. */
function allows(sources, url) {
  const u = new URL(url);
  return (sources ?? []).some((s) => {
    if (!/^https:\/\//.test(s)) return false;
    const src = new URL(s);
    if (src.host !== u.host) return false;
    if (src.pathname === "/" ) return true;
    return s.endsWith("/") ? u.pathname.startsWith(src.pathname) : u.pathname === src.pathname;
  });
}
const sha = (alg, text) => createHash(alg).update(text).digest("base64");

// ---------------------------------------------------------------- web app
const web = policyIn(readFileSync("public/index.html", "utf8"));
check("the web template carries a Content-Security-Policy", web);
if (web) {
  check("web: scripts come only from the app itself", web.get("script-src")?.join(" ") === "'self'", web.get("script-src")?.join(" "));
  check("web: plugins are off", web.get("object-src")?.join(" ") === "'none'");
  check("web: the base URL cannot be rewritten", web.get("base-uri")?.join(" ") === "'self'");
  check("web: the Supabase project is reachable", allows(web.get("connect-src"), SUPABASE_URL), SUPABASE_URL);
  for (const host of PHOTO_HOSTS) {
    check(`web: meal photo host ${host} may be fetched`, allows(web.get("connect-src"), `https://${host}/x`));
    check(`web: meal photo host ${host} may be shown`, allows(web.get("img-src"), `https://${host}/x.jpg`));
  }
  for (const host of FOOD_FACTS_HOSTS) {
    check(`web: food facts host ${host} may be fetched`, allows(web.get("connect-src"), `https://${host}/cgi/search.pl`));
  }
  const blocked = Object.values(EXERCISE_IMAGE).filter((u) => !allows(web.get("img-src"), u));
  check("web: every exercise photo URL is allowed", blocked.length === 0, blocked[0]);
}

// ---------------------------------------------------------------- admin
const adminHtml = readFileSync("admin/index.html", "utf8");
const admin = policyIn(adminHtml);
check("the admin console carries a Content-Security-Policy", admin);
if (admin) {
  const scriptSrc = admin.get("script-src") ?? [];
  const inline = [...adminHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  check("admin: exactly one inline script", inline.length === 1, String(inline.length));
  if (inline.length === 1) {
    const want = `'sha256-${sha("sha256", inline[0])}'`;
    check("admin: the policy names the inline script's current hash", scriptSrc.includes(want), `set script-src to include ${want}`);
  }
  check("admin: no source list allows any inline script", !scriptSrc.includes("'unsafe-inline'"));

  const tag = /<script src="([^"]+)" integrity="([^"]+)" crossorigin="anonymous"><\/script>/.exec(adminHtml);
  check("admin: supabase-js is loaded with an integrity hash", tag);
  if (tag) {
    const [, src, integrity] = tag;
    check("admin: the policy allows exactly that file", scriptSrc.includes(src), src);
    const require = createRequire(import.meta.url);
    const pkgDir = path.dirname(require.resolve("@supabase/supabase-js/package.json"));
    const version = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8")).version;
    check("admin: it pins the same supabase-js version the app uses", src.includes(`@supabase/supabase-js@${version}/dist/umd/supabase.js`), `app has ${version}; point the tag and the policy at ${version}`);
    const want = `sha384-${sha("sha384", readFileSync(path.join(pkgDir, "dist/umd/supabase.js")))}`;
    check("admin: the integrity hash matches that file", integrity === want, `integrity should be ${want}`);
  }
  const url = /const SUPABASE_URL = "([^"]+)"/.exec(adminHtml)?.[1];
  check("admin: the page may reach its Supabase project", url && allows(admin.get("connect-src"), url), url);
  check("admin: nothing else is reachable", (admin.get("connect-src") ?? []).length === 1);
}

// ---------------------------------------------------------------- security.txt
// RFC 9116: how a researcher reaches us. A lapsed Expires tells them the
// contact may be dead, so this fails the build once it has passed.
{
  const txt = readFileSync("public/.well-known/security.txt", "utf8");
  const { LEGAL } = await import(pathToFileURL(out).href);
  const contact = /^Contact: mailto:(.+)$/m.exec(txt)?.[1];
  check("security.txt names the published contact address", contact && contact === LEGAL.contactEmail, `${contact} vs ${LEGAL.contactEmail}`);
  const expires = Date.parse(/^Expires: (.+)$/m.exec(txt)?.[1] ?? "");
  check("security.txt has not expired", expires > Date.now(), "renew the Expires date (at most a year ahead)");
  check("security.txt expires within a year, as RFC 9116 advises", expires < Date.now() + 366 * 86_400_000);
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
