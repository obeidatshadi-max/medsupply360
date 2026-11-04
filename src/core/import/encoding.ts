/**
 * Text encoding of an uploaded CSV. Pure. ERP exports saved by Excel on an Arabic Windows PC are often
 * Windows-1256, not UTF-8; read as UTF-8 the Arabic names turn into garbage. The importer only reads UTF-8,
 * so the browser converts the bytes here before anything else sees them.
 */

export type DecodedText = { text: string; encoding: "utf-8" | "windows-1256" | "utf-16le" | "utf-16be" };

export function decodeBytes(bytes: Uint8Array): DecodedText {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "utf-16be" };
  try {
    // fatal: any byte sequence that is not valid UTF-8 throws instead of becoming U+FFFD.
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1256").decode(bytes), encoding: "windows-1256" };
  }
}
