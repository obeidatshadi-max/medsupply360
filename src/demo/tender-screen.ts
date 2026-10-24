/**
 * The promotional demo's Tenders screen, as HTML for demo/index.html. It shows the same made-up tenders as the in-app
 * sample (/sample/tenders) and reads every figure from the same tested rules, so the two cannot disagree. The demo has
 * no database and no sign-in: the forms the live app uses to move a tender or record money are described, not shown.
 *
 * The Sadaf preset names the real Jordanian authorities. Any other customer profile sees neutral "Authority A–E" labels,
 * so one customer's buyers are never presented as another's.
 */
import { ROLE_LABEL } from "@/core/permissions";
import { AUTHORITIES, LINE_LABEL, STAGE, STATUS_LABEL, STATUSES, closeReasonLabel, type AuthorityCode } from "@/core/tender-flow";
import { GUARANTEE_LABEL } from "@/core/tender-money";
import { tenderValue } from "@/core/tender-overview";
import { itemTotals, lineTotal } from "@/core/tender-items";
import { hasAwardResult, prefillRows } from "@/core/tender-results-prefill";
import { dayText, jod, pct } from "@/lib/format";
import { DEMO_TENDERS, DEMO_TENDER_AS_OF, demoTenderDetail, demoTenderOverview, type DemoTender } from "./tender-demo";

export interface TenderScreenOptions {
  /** True for any profile other than the Sadaf preset: authority names become neutral labels. */
  generic: boolean;
  /** Search text from the demo's search box; it narrows the tender list, never the overview. */
  query?: string;
}

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const panel = (title: string, sub: string, body: string) =>
  `<section class="panel"><div class="panelhead"><div><h2>${title}</h2><p class="sub">${sub}</p></div></div>${body}</section>`;
const table = (headers: string[], rows: string[][], empty = "No matching tender. Change the search.") =>
  `<div class="tablewrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.length
      ? rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${esc(headers[i] ?? "")}">${c}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${headers.length}" class="empty">${empty}</td></tr>`
  }</tbody></table></div>`;
const list = (items: string[], empty: string) => (items.length ? items.join("") : `<p class="mini">${empty}</p>`);
const item = (left: string, right: string) => `<div class="kv"><span>${left}</span><b>${right}</b></div>`;

/** "MOH", or "Authority A" for a non-Sadaf profile. */
export function authorityLabel(code: AuthorityCode, generic: boolean): string {
  if (!generic) return code;
  return `Authority ${String.fromCharCode(65 + AUTHORITIES.findIndex((a) => a.code === code))}`;
}

function authorityName(code: AuthorityCode, generic: boolean): string {
  return generic ? `${authorityLabel(code, true)} (sample public buyer)` : `${code} · ${AUTHORITIES.find((a) => a.code === code)!.name}`;
}

/** A reference with its authority code neutralised for other profiles: "MOH-26-118" becomes "A-26-118". */
function neutral(ref: string | null, t: DemoTender, generic: boolean): string | null {
  if (!ref || !generic) return ref;
  return ref.replace(t.authority, authorityLabel(t.authority, true).slice(-1));
}
const tenderNo = (t: DemoTender, generic: boolean) => neutral(t.tenderNo, t, generic);

function matchesQuery(t: DemoTender, query: string | undefined, generic: boolean): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [t.title, authorityLabel(t.authority, generic), tenderNo(t, generic) ?? "", STATUS_LABEL[t.status], LINE_LABEL[t.productLine], t.owner ?? "not assigned"].some((s) => s.toLowerCase().includes(q));
}

export function tenderScreenHtml({ generic, query }: TenderScreenOptions): string {
  const o = demoTenderOverview();
  const a = (code: AuthorityCode) => esc(authorityLabel(code, generic));
  const open = o.phases.filter((p) => p.key !== "closed");
  const closed = o.phases.find((p) => p.key === "closed")!;
  const largest = Math.max(1, ...open.map((p) => p.value));
  const ref = (id: string, title: string) => `<button class="linkbtn" data-tender="${esc(id)}">${esc(title)}</button>`;

  const phaseCards = `<div class="stats">${open
    .map(
      (p) =>
        `<div class="stat"><div class="label">${p.label}</div><div class="value">${plural(p.count, "tender")}</div><div class="note">${jod(p.value)}${
          p.withoutValue > 0 ? ` · ${plural(p.withoutValue, "tender")} without a value` : ""
        }</div><div class="bar" aria-hidden="true" style="margin-top:8px"><span style="width:${p.value === 0 ? 0 : Math.max(3, Math.round((p.value / largest) * 100))}%"></span></div></div>`,
    )
    .join("")}</div>`;
  const winRate =
    o.results.winRate === null
      ? "not known yet (no tender has been decided)"
      : `${pct(o.results.winRate)} (${o.results.won} won, ${o.results.lost} lost${o.results.wonValue > 0 ? `, ${jod(o.results.wonValue)} awarded` : ""})`;

  const deadlines =
    list(
      o.deadlines.upcoming.map((d) => item(`${ref(d.id, d.title)} <span class="cellsub">${a(d.authority)} · ${STATUS_LABEL[d.status]}</span>`, `${dayText(d.deadline)} · ${d.daysLeft === 0 ? "today" : plural(d.daysLeft, "day") + " left"}`)),
      "No tender is waiting to be submitted with a deadline ahead.",
    ) +
    (o.deadlines.passed.length
      ? `<p class="mini" style="color:var(--red);font-weight:600;margin-top:12px">Deadline passed, not yet submitted</p>` +
        o.deadlines.passed.map((d) => item(`${ref(d.id, d.title)} <span class="cellsub">${a(d.authority)}</span>`, `${dayText(d.deadline)} · ${plural(d.daysAgo, "day")} ago`)).join("")
      : "");

  const awards =
    `<p class="mini" style="font-weight:600;margin-top:12px">Awards expected</p>` +
    (o.awards.expected.length === 0 && o.awards.overdue.length === 0
      ? `<p class="mini">${o.awards.withoutDate === 0 ? "No bid is waiting for a decision." : "No expected award date entered yet."}</p>`
      : o.awards.overdue.map((d) => item(`${ref(d.id, d.title)} <span class="cellsub">${a(d.authority)}</span>`, `<span style="color:var(--red)">expected ${dayText(d.expectedOn)} · ${plural(d.daysAgo, "day")} ago</span>`)).join("") +
        o.awards.expected.map((d) => item(`${ref(d.id, d.title)} <span class="cellsub">${a(d.authority)}</span>`, `${dayText(d.expectedOn)} · ${d.daysLeft === 0 ? "today" : plural(d.daysLeft, "day") + " left"}`)).join("") +
        (o.awards.withoutDate > 0 ? `<p class="mini">${plural(o.awards.withoutDate, "waiting bid")} without an expected date.</p>` : ""));

  const guarantees =
    `<div class="value" style="font-size:26px">${jod(o.guarantees.active)}</div><p class="mini">Held by guarantees that are not returned and not expired.</p>` +
    (o.guarantees.expiredNotReturned > 0 ? `<p class="mini" style="color:var(--red)">${jod(o.guarantees.expiredNotReturned)} is on guarantees that expired but were not returned. Ask the bank.</p>` : "") +
    list(
      o.guarantees.soonest.map((g) => item(`${ref(g.tenderId, g.title)} <span class="cellsub">${jod(g.amount)}</span>`, `expires ${dayText(g.expiresOn)} · ${g.daysLeft === 0 ? "today" : plural(g.daysLeft, "day") + " left"}`)),
      o.guarantees.count === 0 ? "No guarantee recorded yet." : "No active guarantee.",
    );

  const owed = o.authorities.filter((x) => x.unpaid > 0).sort((x, y) => y.unpaid - x.unpaid);
  const unpaid =
    `<div class="value" style="font-size:26px">${jod(o.payments.unpaid)}</div><p class="mini">Invoiced ${jod(o.payments.invoiced)} · collected ${jod(o.payments.collected)}</p>` +
    list(owed.map((x) => item(a(x.code), jod(x.unpaid))), "Nothing is waiting to be collected.");

  const lost =
    (o.results.recentLost.length
      ? o.results.lostByReason.map((r) => item(esc(r.label), String(r.count))).join("") +
        (o.results.uncodedLost > 0 ? item("Closed before reasons were coded", String(o.results.uncodedLost)) : "") +
        `<div style="height:10px"></div>`
      : "") +
    list(
      o.results.recentLost.map((l) =>
        item(
          `${ref(l.id, l.title)} <span class="cellsub">${a(l.authority)} · ${esc(l.reason ?? "No reason recorded")}</span>` +
            (l.winner || l.winningPrice !== null
              ? `<span class="cellsub">Won by ${esc(l.winner ?? "an unnamed bidder")}${l.winningPrice !== null ? ` at ${jod(l.winningPrice)}` : ""}${l.aboveWinnerPct !== null ? ` · our bid was ${Math.abs(l.aboveWinnerPct)}% ${l.aboveWinnerPct >= 0 ? "above" : "below"}` : ""}</span>`
              : ""),
          "Lost",
        ),
      ),
      "No tender has been marked lost.",
    );

  const byAuthority = table(
    ["Authority", "Active", "Active value", "Won", "Lost"],
    o.authorities.map((x) => [`<b>${a(x.code)}</b>`, String(x.active), x.activeValue === 0 ? "—" : jod(x.activeValue), String(x.won), String(x.lost)]),
  );
  const longest = list(
    o.longestInStage.map((t) => item(`${ref(t.id, t.title)} <span class="cellsub">${a(t.authority)} · ${STATUS_LABEL[t.status]}</span>`, plural(t.days, "day"))),
    "No active tender.",
  );

  const rows = DEMO_TENDERS.filter((t) => matchesQuery(t, query, generic)).map((t) => {
    const v = tenderValue(t);
    const no = tenderNo(t, generic);
    const d = demoTenderDetail(t.id)!;
    return [
      `<b>${a(t.authority)}</b>`,
      `${ref(t.id, t.title)}${no ? `<span class="cellsub">${esc(no)}</span>` : ""}`,
      t.owner === null ? `<span class="mini">Not assigned</span>` : esc(t.owner),
      LINE_LABEL[t.productLine],
      `${STATUS_LABEL[t.status]}<span class="cellsub">Stage ${STAGE[t.status].no} of 10</span>`,
      v === null ? "—" : jod(v),
      t.deadline ? dayText(t.deadline) : "—",
      String(d.daysInStage),
    ];
  });

  const stages = STATUSES.filter((s) => s !== "lost" && s !== "cancelled")
    .map(
      (s) =>
        `<div class="step"><span class="stepnum">${STAGE[s].no}</span><div><b>${STAGE[s].name}</b> <span class="mini">Status: ${s === "won" ? "Won, Lost or Cancelled" : STATUS_LABEL[s]}</span><p class="sub">${STAGE[s].action}</p></div></div>`,
    )
    .join("");
  const roles = (["owner", "tender", "finance", "admin"] as const).map((r) => item(ROLE_LABEL[r].name, ROLE_LABEL[r].note)).join("");

  return (
    `<div class="info">Made-up tenders on ${dayText(DEMO_TENDER_AS_OF)}. ${
      generic ? "Authority names are neutral placeholders for this customer." : "They use the real authority names, but the titles, numbers and amounts are invented."
    } In the live app the tender department and finance enter these as each tender moves, the CEO assigns each tender an owner, and the CEO follows them here.</div>` +
    `<p class="mini"><button class="linkbtn" data-route="tenderprices">Price history: what the authorities paid in past tenders →</button></p>` +
    `<div class="ob-row">Where the tenders stand</div>` +
    phaseCards +
    `<p class="mini">Value is the contract if there is one, otherwise the award, our bid, or the estimate. Tenders without any value are counted but not added. Lost or cancelled: ${closed.count}. Win rate: ${winRate}.</p>` +
    `<div class="twocol" style="margin-top:20px">${panel("Submission deadlines", "Tenders not yet submitted, by deadline", deadlines + awards)}${panel("Cash tied up in guarantees", "Bid and performance guarantees held by the bank", guarantees)}</div>` +
    `<div class="twocol" style="margin-top:20px">${panel("Still unpaid by the authorities", "Tender invoices not yet collected", unpaid)}${panel("Why bids were lost", "The reason recorded when a tender is marked lost", lost)}</div>` +
    `<div class="twocol" style="margin-top:20px">${panel("By authority", "Active = not lost, cancelled or collected", byAuthority)}${panel("Longest in their current stage", "A plain count of days, not a deadline: some stages are slow by nature.", longest)}</div>` +
    `<div style="margin-top:20px">${panel("All tenders", `${plural(rows.length, "tender")} · search by owner, authority or product · select one for its guarantees, invoices and history`, table(["Authority", "Tender", "Owner", "Products", "Stage", "Value", "Deadline", "Days in stage"], rows))}</div>` +
    `<div class="twocol" style="margin-top:20px">${panel("How a tender moves", "The department's ten stages. Each move asks only for the details that stage needs.", stages)}${panel(
      "Who can do what",
      "Access in the live app. The owner adds people and sets their access in Settings.",
      roles,
    )}</div>` +
    `<div class="info">A tender's value is not sales until the contract is booked. A tender can be marked Collected only when it has invoices and they are paid in full. Days in stage are plain counts with no time limit.</div>`
  );
}

/** The Price history results file for one decided demo tender, as rows for the demo's download. Null for an undecided or unknown tender. */
export function tenderResultsPrefillRows(id: string, generic: boolean): string[][] | null {
  const t = DEMO_TENDERS.find((x) => x.id === id);
  if (!t || !hasAwardResult(t.status)) return null;
  const decided = [...t.history].reverse().find((h) => h.to === "won" || h.to === "lost");
  const rows = prefillRows(
    { authority: t.authority, tenderNo: tenderNo(t, generic), title: t.title, status: t.status, awardDate: decided?.on ?? null, winnerName: t.winnerName },
    generic ? "Our company" : "Sadaf Medical",
    t.items,
  );
  // Another customer's file never names the Sadaf preset's real authorities.
  const col = rows[0]!.indexOf("Authority");
  return generic ? rows.map((r, i) => (i === 0 ? r : r.map((c, j) => (j === col ? authorityLabel(t.authority, true) : c)))) : rows;
}

/** The item lines of a demo tender with the same totals rule as the live page. Empty text when the tender has none. */
function itemsHtml(t: DemoTender): string {
  if (t.items.length === 0) return "";
  const totals = itemTotals(t.items);
  const cells = t.items.map((i) => {
    const total = lineTotal(i.quantity, i.ourUnitPrice);
    return [esc(i.itemName), `${i.quantity}${i.unit ? ` ${esc(i.unit)}` : ""}`, i.estimatedUnitPrice === null ? "—" : jod(i.estimatedUnitPrice), i.ourUnitPrice === null ? "—" : jod(i.ourUnitPrice), total === null ? "—" : jod(total)];
  });
  return (
    `<h3 style="margin-top:22px">Item lines</h3>` +
    table(["Item", "Quantity", "Authority estimate", "Our price", "Our line total"], cells) +
    `<p class="mini">${totals.bid === null ? `Our bid total is not complete: ${totals.unpriced} line${totals.unpriced === 1 ? "" : "s"} without our price.` : `Our bid total ${jod(totals.bid)}.`}${totals.estimated === null ? "" : ` Authority estimate total ${jod(totals.estimated)}.`} In the live app the tender's bid and estimated values follow the lines once every line has the price.</p>`
  );
}

/** The drawer for one tender: where it stands, its facts, guarantees, invoices and history. Null for an unknown id. */
export function tenderDetailHtml(id: string, generic: boolean): string | null {
  const d = demoTenderDetail(id);
  if (!d) return null;
  const { tender: t, guarantees, invoices, payments } = d;
  const no = tenderNo(t, generic);
  const facts: [string, string][] = [
    ["Authority", authorityName(t.authority, generic)],
    ["Owner", t.owner ?? "Not assigned yet"],
    ["Tender number", no ?? "—"],
    ["Products", LINE_LABEL[t.productLine]],
    ["Estimated value", t.estimatedValue === null ? "—" : jod(t.estimatedValue)],
    ["Submission deadline", t.deadline ? dayText(t.deadline) : "—"],
    ["Expected award date", t.expectedAwardDate ? dayText(t.expectedAwardDate) : "—"],
    ["Our bid", t.bidValue === null ? "—" : jod(t.bidValue)],
    ...(t.winnerName || t.winningPrice !== null ? ([["Winner", `${t.winnerName ?? "Not recorded"}${t.winningPrice === null ? "" : ` · ${jod(t.winningPrice)}`}`]] as [string, string][]) : []),
    ["Award amount", t.awardAmount === null ? "—" : jod(t.awardAmount)],
    ["Contract", t.contractNo ? `${neutral(t.contractNo, t, generic)}${t.contractValue === null ? "" : ` · ${jod(t.contractValue)}`}` : "—"],
    ["Delivered", t.deliveredOn ? dayText(t.deliveredOn) : "—"],
  ];
  const gState = (s: (typeof guarantees)[number]["state"]) =>
    s.state === "returned"
      ? "Returned"
      : s.state === "expired"
        ? `<span style="color:var(--red)">Expired ${plural(s.daysAgo, "day")} ago, not yet returned</span>`
        : s.daysLeft === 0
          ? "Expires today"
          : `${plural(s.daysLeft, "day")} left`;

  return (
    `<div class="eyebrow">TENDER · ${esc(authorityLabel(t.authority, generic))}${no ? ` · ${esc(no)}` : ""}</div><h1 id="drawerTitle">${esc(t.title)}</h1>` +
    `<p class="sub">Stage ${STAGE[t.status].no} of 10 · ${STAGE[t.status].name}</p>` +
    `<div class="detailstats"><div><small>Status</small><strong>${STATUS_LABEL[t.status]}</strong></div><div><small>Days in this stage</small><strong>${d.daysInStage}</strong></div></div>` +
    (t.closeReasonCode || t.closeReason ? `<div class="info">Reason: ${esc([closeReasonLabel(t.closeReasonCode), t.closeReason].filter(Boolean).join(" · "))}</div>` : "") +
    facts.map(([k, v]) => item(k, esc(v))).join("") +
    itemsHtml(t) +
    `<h3 style="margin-top:22px">Guarantees</h3>` +
    list(
      guarantees.map((g) => item(`${GUARANTEE_LABEL[g.kind]} · ${esc(g.reference)}<span class="cellsub">${g.issuedOn ? `Issued ${dayText(g.issuedOn)} · ` : ""}Expires ${dayText(g.expiresOn)}${g.returnedOn ? ` · Returned ${dayText(g.returnedOn)}` : ""}</span>`, `${jod(g.amount)} · ${gState(g.state)}`)),
      "No guarantee recorded for this tender.",
    ) +
    `<h3 style="margin-top:22px">Invoices and payments</h3>` +
    (invoices.length
      ? invoices.map((i) => item(`${esc(i.invoiceNo)}<span class="cellsub">${dayText(i.invoiceDate)}${i.lastCollectedOn ? ` · last payment ${dayText(i.lastCollectedOn)}` : ""}</span>`, `${jod(i.collected)} of ${jod(i.amount)} collected`)).join("") +
        `<p class="mini">Invoiced ${jod(payments.invoiced)} · collected ${jod(payments.collected)} · still unpaid ${jod(payments.outstanding)}</p>`
      : `<p class="mini">${["contracted", "delivered", "collected"].includes(t.status) ? "No invoice recorded yet." : "Finance records invoices once the tender is contracted."}</p>`) +
    (invoices.length ? `<p class="mini">In the live app each invoice is also checked by its number against the ERP files, and flagged when the ERP shows a different amount unpaid.</p>` : "") +
    (hasAwardResult(t.status)
      ? `<h3 style="margin-top:22px">Add the award result to Price history</h3><p class="mini">The file comes with the authority, tender number, title, award date, our company and the result already filled in. Add one row per item and bidder (item, quantity, unit price), then upload it on the Tender department page.</p><p><button class="linkbtn" data-prefill="${esc(t.id)}">Download the prefilled file</button></p>`
      : "") +
    `<h3 style="margin-top:22px">History</h3>` +
    [...t.history]
      .reverse()
      .map((h) => item(`<b>${STATUS_LABEL[h.to]}</b>${h.note ? `<span class="cellsub">${esc(h.note)}</span>` : ""}`, `${dayText(h.on)} · ${esc(h.by)}`))
      .join("") +
    `<div class="info">In the live app the tender department moves the tender and enters its details; finance records guarantees, invoices and payments. Each person types their name on the form and the date and time are saved automatically, as in the Update history tab. This demo only shows the records.</div>`
  );
}

/** Rows for the demo's Export button on the Tenders screen. */
export function tenderCsvRows(generic: boolean, query?: string): (string | number)[][] {
  return [
    ["Authority", "Tender", "Owner", "Tender number", "Products", "Stage", "Value JOD", "Submission deadline", "Days in stage", "Unpaid on invoices JOD"],
    ...DEMO_TENDERS.filter((t) => matchesQuery(t, query, generic)).map((t) => {
      const d = demoTenderDetail(t.id)!;
      return [authorityLabel(t.authority, generic), t.title, t.owner ?? "", tenderNo(t, generic) ?? "", LINE_LABEL[t.productLine], STATUS_LABEL[t.status], tenderValue(t) ?? "", t.deadline ?? "", d.daysInStage, d.payments.outstanding];
    }),
  ];
}
