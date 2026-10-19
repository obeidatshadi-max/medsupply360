import { describe, expect, it } from "vitest";
import { SUBMITTER_MAX, cleanSubmitter, readSubmitter } from "./submitter";

describe("cleanSubmitter", () => {
  it("keeps a normal name and tidies spaces", () => {
    expect(cleanSubmitter("  Lina   Haddad ")).toEqual({ ok: true, name: "Lina Haddad" });
  });

  it("accepts Arabic names", () => {
    expect(cleanSubmitter("ليلى حداد")).toEqual({ ok: true, name: "ليلى حداد" });
  });

  it("refuses empty, one-letter and letterless names", () => {
    for (const bad of ["", "   ", "A", "123", "!!", null, undefined]) expect(cleanSubmitter(bad).ok).toBe(false);
  });

  it("drops control and direction characters", () => {
    expect(cleanSubmitter("Lina‮\nHaddad")).toEqual({ ok: true, name: "Lina Haddad" });
  });

  it("refuses a name that is too long", () => {
    expect(cleanSubmitter("a".repeat(SUBMITTER_MAX + 1)).ok).toBe(false);
    expect(cleanSubmitter("a".repeat(SUBMITTER_MAX)).ok).toBe(true);
  });

  it("reads the name from a form post", () => {
    const fd = new FormData();
    fd.set("submittedBy", "Omar");
    expect(readSubmitter(fd)).toEqual({ ok: true, name: "Omar" });
    expect(readSubmitter(new FormData()).ok).toBe(false);
  });
});
