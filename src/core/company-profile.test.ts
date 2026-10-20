import { describe, expect, it } from "vitest";
import { cleanProfile, emptyProfile, missingFromProfile, yearsInBusiness, type ProfileForm } from "./company-profile";

const form = (over: Partial<ProfileForm> = {}): ProfileForm => ({
  location: "Jordan",
  address: "67 Amer Bin Malek street\nKhalda, Amman",
  founded: "2008",
  team: "About 20 people",
  audience: "Government and private hospitals",
  purpose: "Distributing medical brands",
  erp: "Alpha ERP",
  notes: "",
  ...over,
});

describe("cleanProfile", () => {
  it("accepts a complete profile and keeps line breaks in the longer fields", () => {
    expect(cleanProfile(form(), 2026)).toEqual({ ok: true, value: form() });
  });

  it("accepts an empty profile", () => {
    expect(cleanProfile(emptyProfile, 2026)).toEqual({ ok: true, value: emptyProfile });
  });

  it("tidies spaces and control characters, and limits blank lines", () => {
    const r = cleanProfile(form({ location: "  Amman   Jordan ", address: "Line one\r\n\r\n\r\n\r\nLine two\u0007", team: "20\tpeople" }), 2026);
    expect(r).toMatchObject({ ok: true, value: { location: "Amman Jordan", address: "Line one\n\nLine two", team: "20 people" } });
  });

  it("checks the founding year", () => {
    expect(cleanProfile(form({ founded: "2026" }), 2026).ok).toBe(true);
    for (const bad of ["2027", "1799", "08", "abcd", "2008 AD"]) expect(cleanProfile(form({ founded: bad }), 2026).ok, bad).toBe(false);
  });

  it("refuses a field over its limit and names it", () => {
    const r = cleanProfile(form({ purpose: "x".repeat(2001) }), 2026);
    expect(r).toEqual({ ok: false, error: "Use 2000 characters or fewer for the business purpose." });
  });
});

describe("missingFromProfile", () => {
  it("lists what is not written yet", () => {
    expect(missingFromProfile(emptyProfile)).toEqual(["location", "founding year", "who the company serves", "business purpose", "accounting system"]);
    expect(missingFromProfile(form())).toEqual([]);
    expect(missingFromProfile(form({ erp: "" }))).toEqual(["accounting system"]);
  });
});

describe("yearsInBusiness", () => {
  it("counts from the founding year and gives nothing without one", () => {
    expect(yearsInBusiness("2008", 2026)).toBe(18);
    expect(yearsInBusiness("", 2026)).toBeNull();
    expect(yearsInBusiness("2030", 2026)).toBe(0);
  });
});
