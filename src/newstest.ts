import { NEWS, newsUnseen } from "./news";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

check("a new phone sees the news", newsUnseen(null));
check("once dismissed, it stays gone", !newsUnseen(NEWS.id));
check("the next update shows again", newsUnseen("2000-01-01"));
check("both languages say the same number of things", NEWS.he.length === NEWS.en.length && NEWS.he.length > 0);
check("no line is empty", [...NEWS.he, ...NEWS.en].every((l) => l.trim().length > 0));

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
