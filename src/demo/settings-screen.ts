/**
 * The promotional demo's Settings screen ("People and access"). The people are made-up job titles, never real names. The
 * access table is computed from the app's own permission rules (src/core/permissions.ts), so it cannot drift from what
 * the live app enforces.
 */
import { ASSIGNABLE_ROLES, ROLES, ROLE_LABEL, canAccess, canEditGuarantees, canEditPayments, canEditTender, type Role } from "@/core/permissions";
import { dayText } from "@/lib/format";

export interface DemoPerson {
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastSignIn: string | null;
}

export const DEMO_PEOPLE: DemoPerson[] = [
  { name: "Owner (CEO)", email: "owner@demo-company.example", role: "owner", active: true, lastSignIn: "2026-10-08" },
  { name: "Tender manager", email: "tenders@demo-company.example", role: "tender", active: true, lastSignIn: "2026-10-07" },
  { name: "Finance officer", email: "finance@demo-company.example", role: "finance", active: true, lastSignIn: "2026-10-08" },
  { name: "Sales analyst", email: "sales@demo-company.example", role: "viewer", active: true, lastSignIn: "2026-10-01" },
  { name: "Former tender assistant", email: "assistant@demo-company.example", role: "tender", active: false, lastSignIn: "2026-07-14" },
];

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const yes = `<span class="tag green">Yes</span>`;
const no = `<span class="tag">No</span>`;
const mark = (b: boolean) => (b ? yes : no);
const table = (headers: string[], rows: string[][]) =>
  `<div class="tablewrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td data-label="${esc(headers[i] ?? "")}">${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
const panel = (title: string, sub: string, body: string) =>
  `<section class="panel"><div class="panelhead"><div><h2>${title}</h2><p class="sub">${sub}</p></div></div>${body}</section>`;

/** Rows for the demo's Export button on the Settings screen. */
export const settingsCsvRows = (): string[][] => [
  ["Person", "Email", "Access", "Status", "Last sign-in"],
  ...DEMO_PEOPLE.map((p) => [p.name, p.email, ROLE_LABEL[p.role].name, p.active ? "Active" : "Turned off", p.lastSignIn ?? "Never"]),
];

/** The live app's "Add a person" form, as it looks there. The demo's button saves nothing (see bindSettings in demo/index.html). */
export function addPersonHtml(): string {
  const roles = ASSIGNABLE_ROLES.map((r) => `<option value="${r}">${esc(ROLE_LABEL[r].name)} · ${esc(ROLE_LABEL[r].note)}</option>`).join("");
  return (
    `<form id="demoAddPerson" class="panel" autocomplete="off"><div class="panelhead"><div><h2>Add a person</h2><p class="sub">The owner gives the colleague a first password; they can change it with "Forgot password".</p></div></div>` +
    `<div class="formgrid">` +
    `<label>Full name<input name="fullName" maxlength="200" placeholder="e.g. Sales analyst"></label>` +
    `<label>Email<input name="email" type="email" maxlength="255" placeholder="name@company.example"></label>` +
    `<label>Access<select name="role"><option value="" disabled selected>Choose…</option>${roles}</select></label>` +
    `<label>First password<input name="password" type="password" minlength="12" maxlength="200" placeholder="At least 12 characters"></label>` +
    `</div><p style="margin-top:12px"><button type="submit" class="primary" style="width:auto">Add person</button> <span class="mini">The live app saves the person; here it saves nothing.</span></p></form>`
  );
}

export function settingsHtml({ query }: { query?: string } = {}): string {
  const q = query?.toLowerCase();
  const people = DEMO_PEOPLE.filter((p) => !q || `${p.name} ${p.email} ${ROLE_LABEL[p.role].name}`.toLowerCase().includes(q));
  const peopleTable = table(
    ["Person", "Access", "Last sign-in", "Status"],
    people.map((p) => [
      `${esc(p.name)}<span class="cellsub">${esc(p.email)}</span>`,
      esc(ROLE_LABEL[p.role].name),
      p.lastSignIn ? dayText(p.lastSignIn) : "Never",
      p.active ? `<span class="tag green">Active</span>` : `<span class="tag red">Turned off</span>`,
    ]),
  );
  const access = table(
    ["Access level", "Business screens", "Tenders", "Change tenders", "Guarantees", "Invoices and payments", "Settings"],
    ROLES.map((r) => [
      `<b>${esc(ROLE_LABEL[r].name)}</b><span class="cellsub">${esc(ROLE_LABEL[r].note)}</span>`,
      mark(canAccess(r, "business")),
      mark(canAccess(r, "tender")),
      mark(canEditTender(r)),
      mark(canEditGuarantees(r)),
      mark(canEditPayments(r)),
      mark(canAccess(r, "settings")),
    ]),
  );
  return (
    `<div class="info">Sample people with made-up job titles. In the live app the owner adds a colleague with a first password, picks the access level, and can turn the person off at any time. A change takes effect on their next click. The form below shows how; this demo saves nothing.</div>` +
    addPersonHtml() +
    `<div style="margin-top:20px">` + panel("People with access", `${people.length} of ${DEMO_PEOPLE.length} people · the owner's own access cannot be changed here`, peopleTable) +
    `<div style="margin-top:20px">${panel("What each access level can do", "Computed from the same rules the live app enforces", access)}</div>` +
    `<div class="info">Tender and finance staff see only the Tenders section, so they never see company profit or sales figures.</div>`
  );
}
