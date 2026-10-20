import { describe, expect, it } from "vitest";
import { RESPONSIBLE, addActionHref, cleanAction, isOverdue, prefillFrom, sortActions, summarize, type ActionForm } from "./management-actions";

const form = (over: Partial<ActionForm> = {}): ActionForm => ({ title: "Look into the repeat purchase gap", responsible: "Sales manager", due: "2026-11-01", evidence: "Customer A buys 40% of its estimate", ...over });

describe("cleanAction", () => {
  it("accepts a complete action and tidies the text", () => {
    expect(cleanAction(form({ title: "  Look  into   the gap " }))).toEqual({ ok: true, value: { title: "Look into the gap", responsible: "Sales manager", due: "2026-11-01", evidence: "Customer A buys 40% of its estimate" } });
  });
  it("keeps the evidence optional", () => {
    expect(cleanAction(form({ evidence: "" }))).toMatchObject({ ok: true, value: { evidence: null } });
  });
  it("refuses a short or letterless title, an unknown department, a bad date and over-long text", () => {
    for (const bad of [form({ title: "ab" }), form({ title: "12345" }), form({ responsible: "CEO" }), form({ due: "" }), form({ due: "2026-02-30" }), form({ title: "x".repeat(181) }), form({ evidence: "x".repeat(1001) })]) {
      expect(cleanAction(bad).ok).toBe(false);
    }
  });
  it("accepts a due date in the past: the action then shows as overdue", () => {
    expect(cleanAction(form({ due: "2026-01-01" })).ok).toBe(true);
  });
});

describe("overdue, sort and summary", () => {
  const rows = [
    { status: "open" as const, due: "2026-11-05", responsible: "Sales manager" },
    { status: "open" as const, due: "2026-10-01", responsible: "Finance manager" },
    { status: "done" as const, due: "2026-09-01", responsible: "Sales manager", completedOn: "2026-09-03" },
    { status: "done" as const, due: "2026-09-10", responsible: "HR manager", completedOn: "2026-09-12" },
  ];
  it("is overdue only while open and past due", () => {
    expect(isOverdue(rows[1]!, "2026-10-20")).toBe(true);
    expect(isOverdue(rows[0]!, "2026-10-20")).toBe(false);
    expect(isOverdue(rows[2]!, "2026-10-20")).toBe(false);
    expect(isOverdue({ status: "open", due: "2026-10-20" }, "2026-10-20")).toBe(false);
  });
  it("lists open actions by due date, then the most recently finished", () => {
    expect(sortActions(rows).map((r) => r.due)).toEqual(["2026-10-01", "2026-11-05", "2026-09-10", "2026-09-01"]);
  });
  it("counts the tiles", () => {
    expect(summarize(rows, "2026-10-20")).toEqual({ open: 2, done: 2, overdue: 1, departments: 2 });
  });
});

describe("prefill link", () => {
  it("round-trips a title, evidence and department through the link", () => {
    const href = addActionHref({ title: "Convert uncovered service agreements", evidence: "4 machines with no contract", responsible: "Service manager" });
    expect(href.startsWith("/opportunities?")).toBe(true);
    expect(href.endsWith("#add-action")).toBe(true);
    const params = Object.fromEntries(new URL(`https://x.test${href}`).searchParams);
    expect(prefillFrom(params)).toEqual({ title: "Convert uncovered service agreements", evidence: "4 machines with no contract", responsible: "Service manager" });
  });
  it("ignores an unknown department and anything that is not text", () => {
    expect(prefillFrom({ actionResponsible: "Boss", actionTitle: ["a", "b"] })).toEqual({ title: "", evidence: "", responsible: RESPONSIBLE[0] });
  });
  it("cuts a long title to the limit", () => {
    expect(prefillFrom({ actionTitle: "x".repeat(300) }).title).toHaveLength(180);
  });
});
