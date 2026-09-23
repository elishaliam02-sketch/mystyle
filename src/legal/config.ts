/**
 * The facts every legal surface needs, in one place.
 *
 * `version` is the contract: it is bumped whenever the documents change in a
 * way a person should see, and anyone whose recorded acceptance is older is
 * asked again before they can carry on. Editing a typo does not need a bump;
 * changing what data is collected, who it goes to, or what someone is agreeing
 * to always does.
 */
export const LEGAL = {
  appName: "APEX",
  /** Who is responsible for the data, named in the policy. */
  publisher: "APEX",
  /** The address for privacy requests, deletion, and complaints. */
  contactEmail: "danielzanzuri1301@gmail.com",
  /** Bump this when the documents change materially. */
  version: 2,
  /** The date the current version took effect (YYYY-MM-DD). */
  effective: "2026-09-23",
} as const;

/** Whether a recorded acceptance still covers the documents as they stand. */
export function acceptanceCurrent(acceptedVersion: number | undefined): boolean {
  return (acceptedVersion ?? 0) >= LEGAL.version;
}
