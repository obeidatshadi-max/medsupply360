/**
 * The name typed on a data form. A department shares one sign-in, so the sign-in alone cannot say which person entered
 * a figure: every submission also carries the typed name of the person who made it. The date and time are never typed,
 * the server sets them.
 */
export const SUBMITTER_MIN = 2;
export const SUBMITTER_MAX = 80;
export const SUBMITTER_FIELD = "submittedBy";

export type SubmitterResult = { ok: true; name: string } | { ok: false; error: string };

const MESSAGE = "Enter your name so the record shows who made this change.";

/** Trims, collapses spaces, drops control characters. Arabic and Latin names are both fine; it must contain a letter. */
export function cleanSubmitter(raw: unknown): SubmitterResult {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name.length < SUBMITTER_MIN || !/\p{L}/u.test(name)) return { ok: false, error: MESSAGE };
  if (name.length > SUBMITTER_MAX) return { ok: false, error: `Use ${SUBMITTER_MAX} characters or fewer for your name.` };
  return { ok: true, name };
}

export function readSubmitter(form: FormData): SubmitterResult {
  return cleanSubmitter(form.get(SUBMITTER_FIELD));
}
