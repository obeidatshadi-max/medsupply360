import { describe, expect, it } from "vitest";
import { landingAr, landingEn, type LandingCopy } from "./copy";
import { landingHtml } from "@/demo/landing-html";

/** Same keys and same list lengths in both languages, so one can never silently lose a section. */
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]));
  return typeof v;
}

describe("landing copy", () => {
  it("has the same structure in English and Arabic", () => {
    expect(shape(landingAr)).toEqual(shape(landingEn));
  });

  it("has no empty text", () => {
    const walk = (v: unknown): void => {
      if (typeof v === "string") expect(v.trim()).not.toBe("");
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(landingEn);
    walk(landingAr);
  });

  it("keeps the slogan in both languages", () => {
    expect(landingEn.hero.title).toBe("Every tender. Every device. Every dinar.");
    expect(landingAr.hero.title).toBe("كل مناقصة. كل جهاز. كل دينار.");
  });

  it("shows only figures that the demo overview also shows", () => {
    const demo = `${landingEn.preview.stats.map((s) => s.value).join(" ")}`;
    for (const v of ["JOD 4.54M", "JOD 1.51M", "JOD 3.86M", "JOD 117.1K"]) expect(demo).toContain(v);
  });
});

describe("demo front page", () => {
  const texts = (c: LandingCopy) => [c.hero.title, c.hero.subtitle, c.hero.body, ...c.pillars.items.map((i) => i.title), ...c.how.items.map((i) => i.title)];
  for (const [locale, copy] of [["en", landingEn], ["ar", landingAr]] as const) {
    it(`renders the shared ${locale} copy and the right direction`, () => {
      const html = landingHtml(locale);
      expect(html).toContain(locale === "ar" ? 'dir="rtl"' : 'dir="ltr"');
      for (const t of texts(copy)) expect(html).toContain(t);
    });
  }

  it("offers the demo entry and the other language, and never a sign-in link", () => {
    const html = landingHtml("en");
    expect(html).toContain("data-landing-enter");
    expect(html).toContain('data-landing-lang="ar"');
    expect(html).not.toContain("/login");
  });
});
