/** A form value as a JOD amount: blank is "not known yet", commas are thousands separators, anything else is an error. */
export function parseJod(input: string | null | undefined): number | null | "invalid" {
  const text = (input ?? "").trim().replace(/,/g, "");
  if (text === "") return null;
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return "invalid";
  return Number(text);
}
