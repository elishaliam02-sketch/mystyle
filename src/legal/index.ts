import type { Locale } from "@/i18n";
import { LEGAL, acceptanceCurrent } from "./config";
import { he } from "./documents.he";
import { en } from "./documents.en";
import type { LegalDocument, LegalDocuments, LegalSection } from "./types";

/**
 * The legal layer: the documents, the acceptance rule, and the one switch the
 * non-React code asks before anything personal leaves the device.
 */

export function legalDocuments(locale: Locale): LegalDocuments {
  return locale === "he" ? he : en;
}

export function legalDocument(locale: Locale, which: keyof LegalDocuments): LegalDocument {
  return legalDocuments(locale)[which];
}

/**
 * A mirror of the person's AI consent, readable from plain modules.
 *
 * The consent itself lives in the store, which is React context — and the code
 * that actually calls out to the model (`src/ai/server.ts`) is a plain module
 * with no way to read a hook. Rather than thread a flag through every call
 * site, the store publishes the value here whenever it changes and the
 * transport asks this one question before it opens a socket. One place to
 * check means there is no second path out.
 */
let aiAllowed = false;

export function publishAiConsent(allowed: boolean): void {
  aiAllowed = allowed;
}

export function aiConsentGiven(): boolean {
  return aiAllowed;
}

/**
 * The same mirror for the meal photographs, which `src/kitchen/photo.ts` reads
 * before it searches Commons.
 *
 * It starts `false` rather than `true`, even though the switch itself defaults
 * to on. The store publishes the stored answer once it has loaded, and until
 * then nothing should go out: a default applied while the real answer is still
 * being read is not a default, it is a leak — which is exactly how the photos
 * fetched for people who had turned them off.
 */
let photosAllowed = false;

export function publishPhotoConsent(allowed: boolean): void {
  photosAllowed = allowed;
}

export function photoConsentGiven(): boolean {
  return photosAllowed;
}

export { LEGAL, acceptanceCurrent };
export type { LegalDocument, LegalDocuments, LegalSection };
