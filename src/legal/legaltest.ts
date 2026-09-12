/**
 * The legal layer, checked the way the string tables are.
 *
 * Two things can go wrong here without anyone noticing until it matters: a
 * document drifts out of step between the languages, and a version bump is
 * forgotten so nobody is ever re-asked. Both are cheap to test and expensive
 * to discover in review.
 */

import {
  LEGAL,
  acceptanceCurrent,
  aiConsentGiven,
  photoConsentGiven,
  publishAiConsent,
  publishPhotoConsent,
} from "./index";
import { PHOTO_HOSTS } from "@/kitchen";
import { he } from "./documents.he";
import { en } from "./documents.en";
import type { LegalDocument } from "./types";

const results: [string, boolean, string?][] = [];
const check = (n: string, p: boolean, d?: string) => results.push([n, p, d]);

const docs = [
  ["he.privacy", he.privacy],
  ["he.terms", he.terms],
  ["en.privacy", en.privacy],
  ["en.terms", en.terms],
] as const;

// --- acceptance
{
  check("a fresh install has not accepted anything", !acceptanceCurrent(undefined));
  check("an older acceptance no longer counts", !acceptanceCurrent(LEGAL.version - 1));
  check("the current version counts", acceptanceCurrent(LEGAL.version));
  check("a later version still counts", acceptanceCurrent(LEGAL.version + 1));
  check("the version is a positive whole number",
    Number.isInteger(LEGAL.version) && LEGAL.version >= 1, String(LEGAL.version));
  check("the effective date is a real date",
    /^\d{4}-\d{2}-\d{2}$/.test(LEGAL.effective) && !Number.isNaN(Date.parse(LEGAL.effective)),
    LEGAL.effective);
}

// --- the documents are complete, in both languages
{
  for (const [name, doc] of docs) {
    check(`${name} has a title`, doc.title.trim().length > 0);
    check(`${name} has a summary a person would actually read`, doc.summary.trim().length > 40);
    check(`${name} has sections`, doc.sections.length >= 5, String(doc.sections.length));
    check(`${name}: every section has a heading`, doc.sections.every((s) => s.heading.trim().length > 0));
    check(`${name}: every section says something`,
      doc.sections.every((s) => s.body.length > 0 && s.body.every((line) => line.trim().length > 0)),
      doc.sections.filter((s) => s.body.some((l) => !l.trim())).map((s) => s.id).join(","));
    check(`${name}: section ids are unique`,
      new Set(doc.sections.map((s) => s.id)).size === doc.sections.length);
  }
}

// --- the two languages are the same document
{
  const ids = (doc: LegalDocument) => doc.sections.map((s) => s.id).join(",");
  check("privacy has the same sections in both languages",
    ids(he.privacy) === ids(en.privacy), `${ids(he.privacy)} vs ${ids(en.privacy)}`);
  check("terms have the same sections in both languages",
    ids(he.terms) === ids(en.terms), `${ids(he.terms)} vs ${ids(en.terms)}`);
}

// --- nothing unfinished ships
{
  const text = docs.map(([, doc]) => `${doc.title} ${doc.summary} ${doc.sections.map((s) => `${s.heading} ${s.body.join(" ")}`).join(" ")}`).join(" ");
  const placeholders = ["TODO", "TBD", "lorem", "XXX", "[company", "your company", "example.com"];
  const found = placeholders.filter((p) => text.toLowerCase().includes(p.toLowerCase()));
  check("no placeholder text survives into the documents", found.length === 0, found.join(","));
}

// --- a person can always find out who to write to
{
  for (const [name, doc] of docs) {
    const text = doc.sections.map((s) => s.body.join(" ")).join(" ");
    check(`${name} names the contact address`, text.includes(LEGAL.contactEmail));
  }
}

// --- every party that receives data is disclosed by name
{
  const privacy = [he.privacy, en.privacy].map((d) =>
    d.sections.map((s) => `${s.heading} ${s.body.join(" ")}`).join(" "),
  );
  for (const party of ["Supabase", "Expo", "YouTube", "Google", "Anthropic", "Wikimedia"]) {
    check(`the privacy policy names ${party} in both languages`,
      privacy.every((text) => text.includes(party)), party);
  }
  // A host the app actually contacts has to appear in the policy by the name it
  // answers to, not only by a brand. This is the check that caught the meal
  // photos being fetched from a service the documents never mentioned at all.
  for (const host of PHOTO_HOSTS) {
    check(`the privacy policy names the host ${host}`,
      privacy.every((text) => text.includes(host)), host);
  }
}

// --- and the photo gate, which that service is behind
{
  publishPhotoConsent(false);
  check("photos are not fetched until the stored answer says so", !photoConsentGiven());
  publishPhotoConsent(true);
  check("turning them on reaches the kitchen", photoConsentGiven());
  publishPhotoConsent(false);
  check("turning them off takes effect immediately", !photoConsentGiven());
}

// --- the consent mirror the AI transport reads
{
  publishAiConsent(false);
  check("nothing is allowed until it is published", !aiConsentGiven());
  publishAiConsent(true);
  check("consent reaches the transport", aiConsentGiven());
  publishAiConsent(false);
  check("withdrawing it takes effect immediately", !aiConsentGiven());
}

const failed = results.filter(([, ok]) => !ok);
for (const [n, ok, d] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  ← ${d ?? ""}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
