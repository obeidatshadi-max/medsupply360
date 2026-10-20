/**
 * The promotional demo's Sales force screen and the quick-assign list on Products & suppliers. The people, emails,
 * accounts and targets are invented. Sales per person are the made-up account sales from ./accounts, and progress against
 * the monthly target uses the app's own rule (src/core/sales-force.ts), so the demo reads like the live screen.
 *
 * Assignments made in the demo are kept for the session only (the page passes them in as `overrides`).
 */
import { activityProgress, weekEnd, weekStart } from "@/core/sales-activity";
import { TARGET_WORD, elapsedMonths, targetProgress, type TargetStatus } from "@/core/sales-force";
import { dayText, jod, pct } from "@/lib/format";
import { allAccountRows } from "./accounts";
import { DEMO_AS_OF, DEMO_PERIOD } from "./dataset";
import { DEMO_TENDERS } from "./tender-demo";

export interface DemoSalesPerson {
  name: string;
  email: string;
  /** Supplier companies they represent. */
  suppliers: string[];
  monthlyTarget: number;
  newAccounts: number;
  visits: number;
  /** Made-up activity so far: new accounts this month and visits this week, against the two targets above. */
  newThisMonth: number;
  visitsThisWeek: number;
  active: boolean;
}

/** Made-up visits, newest first, for the person drawer. Customer names are the demo's invented accounts. */
const SAMPLE_VISITS: Record<string, { on: string; customer: string; note: string }[]> = {
  "Khaled Mansour": [
    { on: "2026-10-07", customer: "Dabouq Heights Private Hospital", note: "Infusion pump demonstration to the biomedical team" },
    { on: "2026-10-06", customer: "Jabal Amman University Hospital", note: "Follow-up on the open quotation" },
  ],
  "Dina Abu-Zaid": [{ on: "2026-10-06", customer: "Rawabi Wound and Diabetes Clinic", note: "Consumables reorder discussion" }],
  "Yousef Nasrallah": [],
  "Hani Tarawneh": [],
};

/** Account ids (see accounts-dataset) each person holds. */
const ACCOUNTS: Record<string, string[]> = {
  "Khaled Mansour": ["T-01", "T-02"],
  "Dina Abu-Zaid": ["P-01", "P-04"],
  "Yousef Nasrallah": ["T-03", "T-04", "P-02"],
  "Hani Tarawneh": ["P-03"],
};

/** How far each person is from their target, so the demo shows on-target, behind and well-behind people side by side. */
const PACE: Record<string, number> = { "Khaled Mansour": 1.08, "Dina Abu-Zaid": 0.82, "Yousef Nasrallah": 0.55, "Hani Tarawneh": 1.0 };

const accountSales = (ids: string[]) => allAccountRows().filter((r) => ids.includes(r.seed.id)).reduce((s, r) => s + r.sales, 0);
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

const BASE: Omit<DemoSalesPerson, "monthlyTarget">[] = [
  { name: "Khaled Mansour", email: "khaled@demo-company.example", suppliers: ["MEDIMA Sp. z o.o.", "BOWA-electronic GmbH & Co. KG"], newAccounts: 2, visits: 12, newThisMonth: 2, visitsThisWeek: 2, active: true },
  { name: "Dina Abu-Zaid", email: "dina@demo-company.example", suppliers: ["Vapotherm, Inc.", "Wassenburg Medical B.V."], newAccounts: 1, visits: 10, newThisMonth: 0, visitsThisWeek: 1, active: true },
  { name: "Yousef Nasrallah", email: "yousef@demo-company.example", suppliers: ["MolecuLight Inc."], newAccounts: 2, visits: 14, newThisMonth: 1, visitsThisWeek: 0, active: true },
  { name: "Hani Tarawneh", email: "hani@demo-company.example", suppliers: [], newAccounts: 1, visits: 8, newThisMonth: 0, visitsThisWeek: 0, active: false },
];

export const DEMO_SALES_FORCE: DemoSalesPerson[] = BASE.map((p) => ({
  ...p,
  monthlyTarget: roundTo(accountSales(ACCOUNTS[p.name] ?? []) / elapsedMonths(DEMO_AS_OF) / (PACE[p.name] ?? 1), 500),
}));

export interface DemoProduct {
  name: string;
  manufacturer: string;
  line: string;
}

/** Who holds a product: the CEO's choice in this session if there is one, otherwise the person who represents its supplier. */
export function assigneeOf(p: DemoProduct, overrides: Record<string, string>): string | null {
  if (p.name in overrides) return overrides[p.name] || null;
  return DEMO_SALES_FORCE.find((s) => s.suppliers.includes(p.manufacturer))?.name ?? null;
}

/** The sales person who holds a demo account (by its id on the accounts screens), or null when nobody does. */
export const accountHolder = (accountId: string): string | null => Object.entries(ACCOUNTS).find(([, ids]) => ids.includes(accountId))?.[0] ?? null;

export const ownerNames = () => DEMO_SALES_FORCE.map((p) => p.name);

const TONE: Record<TargetStatus, string> = { on: "var(--green)", behind: "var(--gold)", far: "var(--red)", none: "var(--muted)" };

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const table = (headers: string[], rows: string[][], empty: string) =>
  `<div class="tablewrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${esc(headers[i] ?? "")}">${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty">${empty}</td></tr>`
  }</tbody></table></div>`;

interface Held {
  person: DemoSalesPerson;
  accounts: { id: string; name: string; city: string; sales: number }[];
  products: DemoProduct[];
  tenders: typeof DEMO_TENDERS;
  ytd: number;
}

function heldBy(person: DemoSalesPerson, products: DemoProduct[], overrides: Record<string, string>): Held {
  const rows = allAccountRows().filter((r) => (ACCOUNTS[person.name] ?? []).includes(r.seed.id));
  return {
    person,
    accounts: rows.map((r) => ({ id: r.seed.id, name: r.seed.name, city: r.seed.city, sales: r.sales })),
    products: products.filter((p) => assigneeOf(p, overrides) === person.name),
    tenders: DEMO_TENDERS.filter((t) => t.owner === person.name),
    ytd: rows.reduce((s, r) => s + r.sales, 0),
  };
}

export interface SalesForceOptions {
  /** The products listed on Products & suppliers (the demo's catalog, after any customer profile change). */
  products: DemoProduct[];
  /** Product name to person name ("" = nobody) chosen in this session. */
  overrides: Record<string, string>;
  query?: string;
  /** True for any profile other than the Sadaf preset: supplier names are not claimed for another customer. */
  generic: boolean;
}

const supplierText = (p: DemoSalesPerson, generic: boolean) => (generic ? "—" : p.suppliers.length ? esc(p.suppliers.join(", ")) : "—");

export function salesForceHtml({ products, overrides, query, generic }: SalesForceOptions): string {
  const q = query?.toLowerCase();
  const people = DEMO_SALES_FORCE.filter((p) => !q || `${p.name} ${p.email} ${p.suppliers.join(" ")}`.toLowerCase().includes(q));
  const rows = people.map((person) => {
    const h = heldBy(person, products, overrides);
    const tp = targetProgress(h.ytd, person.monthlyTarget, DEMO_AS_OF);
    return [
      `<button class="linkbtn" data-sfperson="${esc(person.name)}">${esc(person.name)}</button><span class="cellsub">${esc(person.email)}</span>${person.active ? "" : `<span class="cellsub" style="color:var(--red)">Turned off</span>`}`,
      supplierText(person, generic),
      String(h.products.length),
      String(h.accounts.length),
      String(h.tenders.length),
      `${jod(person.monthlyTarget)} a month<span class="cellsub">${plural(person.newAccounts, "new account")} a month · ${plural(person.visits, "visit")} a week</span>`,
      `${jod(h.ytd)}<span class="cellsub" style="color:${TONE[tp.status]}">${tp.ratio === null ? TARGET_WORD.none : `${pct(tp.ratio)} of target so far · ${TARGET_WORD[tp.status]}`}</span>`,
    ];
  });
  return (
    `<div class="info">Made-up sales people and figures. In the live app the owner adds people, ${generic ? "" : "picks the supplier companies each represents, "}sets what he expects of each one, and assigns products (on Products &amp; suppliers), customer accounts and tenders to them. Open a person to see everything they hold.</div>` +
    `<section class="panel"><div class="panelhead"><div><h2>Your sales team</h2><p class="sub">Sales are the net sales on each person's accounts, ${DEMO_PERIOD}, as of ${dayText(DEMO_AS_OF)}. An account's earlier sales follow whoever holds it today. The target so far is the monthly target times the months passed.</p></div></div>` +
    table(["Person", "Suppliers", "Products", "Accounts", "Tenders", "Expected", `Sales, ${DEMO_PERIOD}`], rows, "No matching person. Change the search.") +
    `</section>` +
    `<div class="info">New accounts and visits are expectations the owner sets. The system does not count them yet.</div>`
  );
}

/** The drawer for one person: figures, accounts, products and tenders. Null for an unknown name. */
const goal = (done: number, target: number) => (activityProgress(done, target).status === "on" ? "On target" : "Behind");

/** The live app's "Log a visit" form. The demo's button saves nothing (see the toast in demo/index.html). */
function visitFormHtml(): string {
  return (
    `<form id="demoVisitForm" class="panel" autocomplete="off" style="margin-top:14px"><div class="panelhead"><div><h2>Log a visit</h2><p class="sub">One line for each customer visit this person made. The count of visits in the week comes from these lines.</p></div></div>` +
    `<div class="formgrid"><label>Date of the visit<input name="visitedOn" type="date" value="${DEMO_AS_OF}" max="${DEMO_AS_OF}"></label>` +
    `<label>What happened (optional)<input name="note" maxlength="300" placeholder="For example: demonstrated the analyzer to the lab manager"></label></div>` +
    `<p style="margin-top:12px"><button type="submit" class="primary" style="width:auto">Save the visit</button> <span class="mini">The live app saves it; here it saves nothing.</span></p></form>`
  );
}

export function salesPersonHtml(name: string, opts: Pick<SalesForceOptions, "products" | "overrides" | "generic">): string | null {
  const person = DEMO_SALES_FORCE.find((p) => p.name === name);
  if (!person) return null;
  const h = heldBy(person, opts.products, opts.overrides);
  const tp = targetProgress(h.ytd, person.monthlyTarget, DEMO_AS_OF);
  const kv = (l: string, r: string) => `<div class="kv"><span>${l}</span><b>${r}</b></div>`;
  const list = (items: string[], empty: string) => (items.length ? items.join("") : `<p class="mini">${empty}</p>`);
  return (
    `<div class="eyebrow">SALES FORCE</div><h1 id="drawerTitle">${esc(person.name)}</h1>` +
    `<p class="sub">${esc(person.email)}${person.active ? "" : " · Turned off"}</p>` +
    `<div class="detailstats"><div><small>Sales, ${DEMO_PERIOD}</small><strong>${jod(h.ytd)}</strong></div><div><small>Monthly target so far</small><strong>${tp.expected === null ? "—" : jod(tp.expected)}</strong></div></div>` +
    `<div class="info" style="margin-top:0">${tp.ratio === null ? TARGET_WORD.none : `${pct(tp.ratio)} of the target so far · ${TARGET_WORD[tp.status]}`}</div>` +
    kv("Supplier companies", supplierText(person, opts.generic)) +
    kv("Monthly sales target", jod(person.monthlyTarget)) +
    kv("New accounts this month", `${person.newThisMonth} of ${person.newAccounts} · ${goal(person.newThisMonth, person.newAccounts)}`) +
    kv(`Visits this week (${dayText(weekStart(DEMO_AS_OF))} to ${dayText(weekEnd(weekStart(DEMO_AS_OF)))})`, `${person.visitsThisWeek} of ${person.visits} · ${goal(person.visitsThisWeek, person.visits)}`) +
    `<h3 style="margin-top:22px">Customer visits</h3>` +
    list((opts.generic ? [] : (SAMPLE_VISITS[person.name] ?? [])).map((v) => kv(`${dayText(v.on)} · ${esc(v.customer)}<span class="cellsub">${esc(v.note)}</span>`, "")), "No visit written down yet.") +
    visitFormHtml() +
    `<h3 style="margin-top:22px">Customer accounts (${h.accounts.length})</h3>` +
    list(h.accounts.map((a) => kv(`<button class="linkbtn" data-goto-account="${esc(a.name)}">${esc(a.name)}</button><span class="cellsub">${esc(a.city)}</span>`, jod(a.sales))), "No account assigned.") +
    `<h3 style="margin-top:22px">Products (${h.products.length})</h3>` +
    list(h.products.map((p) => kv(esc(p.name), esc(p.line))), "No product assigned yet.") +
    `<h3 style="margin-top:22px">Tenders (${h.tenders.length})</h3>` +
    list(h.tenders.map((t) => `<div class="kv"><span><button class="linkbtn" data-tender="${esc(t.id)}">${esc(t.title)}</button></span><b>${esc(t.authority)}</b></div>`), "No tender assigned.") +
    `<div class="info">In the live app the owner edits this profile, adds and removes accounts here, assigns products on Products &amp; suppliers, and chooses the tender owner on each tender.</div>`
  );
}

/**
 * The quick-assign list shown under Products & suppliers: products grouped by supplier, a person per product, and one
 * click to give a whole supplier to one person. Returns an empty string for another customer's profile.
 */
export function productAssignHtml({ products, overrides, query, generic }: SalesForceOptions): string {
  if (generic) return "";
  const q = query?.toLowerCase();
  const shown = products.filter((p) => !q || `${p.name} ${p.manufacturer}`.toLowerCase().includes(q));
  const groups = new Map<string, DemoProduct[]>();
  for (const p of shown) (groups.get(p.manufacturer) ?? groups.set(p.manufacturer, []).get(p.manufacturer)!).push(p);
  const active = DEMO_SALES_FORCE.filter((p) => p.active);
  const select = (attr: string, value: string, current: string | null, empty: string, allowOff = true) =>
    `<select ${attr}="${esc(value)}" aria-label="Sales person">${`<option value="">${empty}</option>`}${DEMO_SALES_FORCE.filter((p) => p.active || (allowOff && p.name === current))
      .map((p) => `<option value="${esc(p.name)}"${p.name === current ? " selected" : ""}>${esc(p.name)}${p.active ? "" : " (turned off)"}</option>`)
      .join("")}</select>`;
  const body = [...groups.entries()]
    .map(([supplier, items]) => {
      const assigned = items.filter((p) => assigneeOf(p, overrides)).length;
      return (
        `<details class="panel" data-supplier="${esc(supplier)}" style="padding:0"><summary style="cursor:pointer;padding:14px 18px;font-weight:600">${esc(supplier)} <span class="mini" style="font-weight:400">· ${plural(items.length, "product")} · ${assigned} assigned</span></summary>` +
        `<div style="padding:0 18px 14px"><p class="mini" style="margin:0 0 8px">Assign all of ${esc(supplier)} to ${`<select data-assign-supplier="${esc(supplier)}" aria-label="Assign all of ${esc(supplier)}"><option value="">Choose a person…</option><option value="__none">Nobody (clear)</option>${active.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("")}</select>`}</p>` +
        table(
          ["Product", "Line", "Sales person"],
          items.map((p) => [esc(p.name), esc(p.line), select("data-assign-product", p.name, assigneeOf(p, overrides), "Not assigned")]),
          "",
        ) +
        `</div></details>`
      );
    })
    .join("");
  return (
    `<div class="ob-row" style="margin-top:22px">Products and who sells them</div>` +
    `<div class="info" style="margin-top:0">Choose a sales person for each product, or give all the products of a supplier to one person. What you choose here appears on the Sales force screen straight away. In this demo the choices last until you reload the page.</div>` +
    (body || `<p class="mini">No matching product. Change the search.</p>`)
  );
}

/** Rows for the demo's Export button on the Sales force screen. */
export function salesForceCsvRows(opts: Pick<SalesForceOptions, "products" | "overrides" | "generic">): (string | number)[][] {
  return [
    ["Person", "Email", "Suppliers", "Products", "Accounts", "Tenders", "Monthly target JOD", "New accounts a month", "Visits a week", `Sales ${DEMO_PERIOD} JOD`, "Status"],
    ...DEMO_SALES_FORCE.map((p) => {
      const h = heldBy(p, opts.products, opts.overrides);
      return [p.name, p.email, opts.generic ? "" : p.suppliers.join("; "), h.products.length, h.accounts.length, h.tenders.length, p.monthlyTarget, p.newAccounts, p.visits, Math.round(h.ytd), p.active ? "Active" : "Turned off"];
    }),
  ];
}
