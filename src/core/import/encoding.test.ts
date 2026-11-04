import { describe, expect, it } from "vitest";
import { decodeBytes } from "./encoding";

describe("decodeBytes", () => {
  it("reads UTF-8 as is, with Arabic intact", () => {
    const r = decodeBytes(new TextEncoder().encode("code,name\nC-1,صيدلية الشفاء\n"));
    expect(r.encoding).toBe("utf-8");
    expect(r.text).toContain("صيدلية الشفاء");
  });

  it("falls back to Windows-1256 when the bytes are not valid UTF-8", () => {
    // "مرحبا" in Windows-1256
    const bytes = new Uint8Array([0xe3, 0xd1, 0xcd, 0xc8, 0xc7]);
    const r = decodeBytes(bytes);
    expect(r.encoding).toBe("windows-1256");
    expect(r.text).toBe("مرحبا");
  });

  it("reads UTF-16 with a byte-order mark", () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
    expect(decodeBytes(bytes)).toEqual({ text: "AB", encoding: "utf-16le" });
  });
});
