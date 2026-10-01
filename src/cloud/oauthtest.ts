import { callbackPath, hasPasswordIdentity, isProvider, paramsOf, readCallback, safeNext } from "./oauthlink";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

// Where to go after: only inside the app.
check("an in-app path is kept", safeNext("/profile") === "/profile");
check("a path with a query is kept", safeNext("/recipe/12?x=1") === "/recipe/12?x=1");
check("another site is refused", safeNext("https://evil.com") === "/");
check("a protocol-relative link is refused", safeNext("//evil.com") === "/");
check("a backslash trick is refused", safeNext("/\\evil.com") === "/");
check("javascript: is refused", safeNext("javascript:alert(1)") === "/");
check("nothing means home", safeNext(undefined) === "/");
check("a list is not a path", safeNext(["/profile"]) === "/");

check("the callback carries the provider and an encoded next",
  callbackPath("google", "/profile") === "/auth-callback?p=google&next=%2Fprofile");
check("the callback never carries a foreign next",
  callbackPath("apple", "https://evil.com") === "/auth-callback?p=apple&next=%2F");

check("google and apple are providers", isProvider("google") && isProvider("apple"));
check("anything else is not", !isProvider("github") && !isProvider(undefined));

// What came back.
const kind = (p: Record<string, string>) => readCallback(p).kind;
check("a code is redeemed", kind({ code: "abc" }) === "code");
const c = readCallback({ code: ["first", "second"] as unknown as string });
check("the first of repeated codes is used", c.kind === "code" && c.code === "first");
check("nothing back means the web already redeemed it", kind({}) === "none");
check("an identity owned by another account signs in to it",
  kind({ error: "server_error", error_code: "identity_already_exists", error_description: "Identity is already linked to another user" }) === "alreadyLinked");
check("the same, told only in words",
  kind({ error: "invalid_request", error_description: "Identity is already linked to another user" }) === "alreadyLinked");
check("closing the provider's page is a cancel", kind({ error: "access_denied", error_description: "The user denied access" }) === "cancelled");
check("a server failure is an error", kind({ error: "server_error", error_description: "Unable to exchange external code" }) === "error");
check("an error beats a code", kind({ code: "abc", error: "server_error" }) === "error");

// The fragment, read by hand on the web.
const f = paramsOf("#error=access_denied&error_description=The+user+denied%20access");
check("the fragment is read", f.error === "access_denied" && f.error_description === "The user denied access");
check("a query string reads the same", paramsOf("?code=x").code === "x");
check("an empty fragment is empty", Object.keys(paramsOf("")).length === 0);

// Who proves themselves with a password.
check("an email account has a password", hasPasswordIdentity({ provider: "email", providers: ["email"] }));
check("a google-only account does not", !hasPasswordIdentity({ provider: "google", providers: ["google"] }));
check("an apple-only account does not", !hasPasswordIdentity({ provider: "apple", providers: ["apple"] }));
check("email plus google still has one", hasPasswordIdentity({ provider: "google", providers: ["google", "email"] }));
check("only the single provider field is read when there is no list", !hasPasswordIdentity({ provider: "apple" }));
check("no record keeps asking for the password", hasPasswordIdentity({}) && hasPasswordIdentity(undefined));

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
