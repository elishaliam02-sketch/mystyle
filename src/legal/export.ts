import type { AppState } from "@/store/types";
import { LEGAL } from "./config";

/**
 * "Give me everything you hold about me", answered by the app rather than by a
 * person reading an inbox.
 *
 * The right to a copy is the one privacy right that is usually honoured with a
 * support address and a two-week wait. It costs almost nothing to answer
 * properly here: everything the app knows already lives in one object, so the
 * export is that object plus a header saying what it is.
 *
 * This file is the pure half — what the copy contains and what it is called.
 * Handing it to the platform lives in `deliver.ts`, so the shape of an export
 * can be tested in plain Node without dragging the UI runtime in behind it.
 */

export type DataExport = {
  /** What this file is, so it is readable in a year without this codebase. */
  meta: {
    app: string;
    exportedAt: string;
    /** The documents version in force when this was taken. */
    legalVersion: number;
    /** The account the data belongs to, when there is one. */
    account: string | null;
    note: string;
  };
  data: AppState;
};

/**
 * Everything held, verbatim. No filtering: a copy that quietly omits fields is
 * worse than useless, because the person cannot tell what is missing.
 */
export function buildExport(
  state: AppState,
  opts: { email?: string | null; now?: string } = {},
): DataExport {
  return {
    meta: {
      app: LEGAL.appName,
      exportedAt: opts.now ?? new Date().toISOString(),
      legalVersion: LEGAL.version,
      account: opts.email ?? null,
      note:
        "Everything this app holds about you, as stored on the device. Progress photos are files on your phone and are referenced here by path, not copied into this file.",
    },
    data: state,
  };
}

/** A filename someone can find again in a downloads folder. */
export function exportFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${LEGAL.appName.toLowerCase()}-data-${stamp}.json`;
}

/** Pretty-printed, because a person may well open it in a text editor. */
export function serializeExport(value: DataExport): string {
  return JSON.stringify(value, null, 2);
}
