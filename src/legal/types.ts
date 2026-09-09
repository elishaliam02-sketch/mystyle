/**
 * The shape of a legal document. Structured sections rather than one blob of
 * markdown: the app renders them with its own type scale, a screen can link
 * straight to a section, and — the real reason — `documents.en.ts` is typed
 * against the Hebrew original, so a section added in one language fails the
 * build until the other has it too. The same trick the string tables use, for
 * the text where a missing translation matters most.
 */
export type LegalSection = {
  /** Stable id, so a link or a support reply can name a section. */
  id: string;
  heading: string;
  /** Paragraphs. A line starting with "• " renders as a bullet. */
  body: string[];
};

export type LegalDocument = {
  title: string;
  /** One paragraph a person can read instead of the whole thing. */
  summary: string;
  sections: LegalSection[];
};

export type LegalDocuments = {
  privacy: LegalDocument;
  terms: LegalDocument;
};
