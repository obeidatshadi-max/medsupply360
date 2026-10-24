import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerLink } from "@/components/customer-link";
import { PageHeading } from "@/components/page-heading";
import { windowEnd } from "@/core/freshness";
import { canManageSalesForce, canSeeSalesForce } from "@/core/permissions";
import { activityProgress, monthOf, newAccountsInMonth, weekEnd, weekStart } from "@/core/sales-activity";
import { TARGET_WORD, targetProgress } from "@/core/sales-force";
import { STATUS_LABEL, type TenderStatus } from "@/core/tender-flow";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { companyDataSummary } from "@/lib/company-data-summary";
import { dateRange, dayText, jod, pct } from "@/lib/format";
import { assignAccountAction, removeVisitAction, setSalesPersonActiveAction } from "@/server/actions/sales-force";
import { countVisits, firstInvoiceDatesOfAccounts, getSalesPerson, listPersonAccounts, listVisits, listPersonProducts, listPersonTenders, listSupplierNames, listUnassignedAccounts, salesByPerson, salesByPersonProducts } from "@/server/services/sales-force";
import { EditPersonForm } from "../person-forms";
import { VisitForm } from "../visit-form";

export const metadata: Metadata = { title: "Sales person" };

const small = "rounded-[7px] border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-brand";

export default async function SalesPersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (user.guest || !canSeeSalesForce(user.role)) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const db = getDb();
  const person = await getSalesPerson(db, user.companyId, id);
  if (!person) notFound();

  const d = await companyDataSummary(user.companyId);
  const to = windowEnd(businessToday(), d.latestInvoice);
  const from = `${to.slice(0, 4)}-01-01`;
  const manage = canManageSalesForce(user.role);
  const today = businessToday();
  const weekFrom = weekStart(today);
  const [sales, productSales, productsHeld, accounts, tenderList, suppliers, candidates, firstOrders, visitsThisWeek, visits] = await Promise.all([
    salesByPerson(db, user.companyId, from, to),
    salesByPersonProducts(db, user.companyId, from, to),
    listPersonProducts(db, user.companyId, person.id),
    listPersonAccounts(db, user.companyId, person.id),
    listPersonTenders(db, user.companyId, person.id),
    manage ? listSupplierNames(db, user.companyId) : Promise.resolve([]),
    manage ? listUnassignedAccounts(db, user.companyId, search, 25) : Promise.resolve([]),
    firstInvoiceDatesOfAccounts(db, user.companyId, person.id),
    countVisits(db, user.companyId, person.id, weekFrom, weekEnd(weekFrom)),
    listVisits(db, user.companyId, person.id, 15),
  ]);
  const ytd = sales.get(person.id) ?? 0;
  const productYtd = productSales.get(person.id) ?? 0;
  const tp = targetProgress(ytd, person.monthlySalesTarget, to);
  const month = monthOf(to);
  const newAccounts = newAccountsInMonth(firstOrders, month);
  const newProgress = activityProgress(newAccounts, person.newAccountsTarget);
  const visitProgress = activityProgress(visitsThisWeek, person.visitsPerWeek);
  const goalNote = (target: number | null, p: ReturnType<typeof activityProgress>, unit: string) =>
    target === null ? "No target set" : `Target ${target} ${unit} · ${pct(p.ratio ?? 0)} reached · ${p.status === "on" ? "On target" : "Behind"}`;

  const stat = (label: string, value: string, note?: string) => (
    <div className="rounded-[9px] border border-line bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="my-1 text-xl tabular-nums">{value}</p>
      {note ? <p className="text-[11px] text-muted">{note}</p> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Sales force`}
        title={person.name}
        sub={[person.email, person.supplierNames.length ? `Represents ${person.supplierNames.join(", ")}` : null, person.active ? null : "Turned off"].filter(Boolean).join(" · ") || "No email or supplier recorded yet"}
      />
      <p className="text-sm">
        <Link href="/sales-force" className="underline underline-offset-2">
          ← Sales force
        </Link>
      </p>

      <section aria-label="Figures" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stat("Sales on their accounts", accounts.length === 0 ? "—" : jod(ytd), `${dateRange(from, to)}, year to date. Follows who holds each account today, earlier sales included.`)}
        {stat("Sales of their products", productsHeld.length === 0 ? "—" : jod(productYtd), "Whoever bought them. Overlaps the figure on accounts, so do not add the two.")}
        {stat(
          "Monthly target so far",
          tp.expected === null ? "—" : jod(tp.expected),
          tp.ratio === null ? TARGET_WORD.none : accounts.length === 0 ? "Target set; no accounts assigned yet" : `${pct(tp.ratio)} reached · ${TARGET_WORD[tp.status]}`,
        )}
        {stat("New accounts this month", String(newAccounts), `${goalNote(person.newAccountsTarget, newProgress, "a month")}. An account counts when its first order in the imported sales falls in ${month}.`)}
        {stat("Visits this week", String(visitsThisWeek), `${goalNote(person.visitsPerWeek, visitProgress, "a week")}. Week of ${dayText(weekFrom)}.`)}
      </section>

      {manage ? (
        <>
          <EditPersonForm
            id={person.id}
            supplierOptions={suppliers}
            values={{
              name: person.name,
              email: person.email ?? "",
              suppliers: person.supplierNames,
              monthlySalesTarget: person.monthlySalesTarget === null ? "" : String(person.monthlySalesTarget),
              newAccountsTarget: person.newAccountsTarget === null ? "" : String(person.newAccountsTarget),
              visitsPerWeek: person.visitsPerWeek === null ? "" : String(person.visitsPerWeek),
            }}
          />
          <form action={setSalesPersonActiveAction} className="flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="id" value={person.id} />
            <input type="hidden" name="active" value={person.active ? "false" : "true"} />
            <span className={person.active ? "text-brand" : "text-bad"}>{person.active ? "Can be given new products, accounts and tenders." : "Turned off: keeps what they hold, gets nothing new."}</span>
            <button type="submit" className={small}>
              {person.active ? "Turn off" : "Turn on"}
            </button>
          </form>
        </>
      ) : null}

      <section aria-label="Visits" className="space-y-3">
        <h2 className="text-sm font-semibold">Customer visits</h2>
        {manage ? <VisitForm personId={person.id} today={today} customers={accounts.map((c) => ({ id: c.id, label: `${c.name} · ${c.code}` }))} /> : null}
        {visits.length === 0 ? (
          <p className="text-sm text-muted">No visit written down yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white text-sm">
            {visits.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  <span className="tabular-nums">{dayText(v.visitedOn)}</span>
                  {v.customerName ? <span className="ml-2">{v.customerName} <span className="text-xs text-muted">{v.customerCode}</span></span> : null}
                  {v.note ? <span className="ml-2 text-muted">{v.note}</span> : null}
                </span>
                {manage ? (
                  <form action={removeVisitAction}>
                    <input type="hidden" name="visitId" value={v.id} />
                    <input type="hidden" name="personId" value={person.id} />
                    <button type="submit" className="text-xs text-bad underline underline-offset-2">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Products" className="space-y-2">
        <h2 className="text-sm font-semibold">Products ({productsHeld.length})</h2>
        {productsHeld.length === 0 ? (
          <p className="text-sm text-muted">No product assigned yet. {manage ? "Assign products on Products & suppliers." : ""}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white text-sm">
            {productsHeld.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                <span>{p.name}</span>
                <span className="text-xs text-muted">
                  {p.code}
                  {p.supplierName ? ` · ${p.supplierName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {manage ? (
          <Link href="/portfolio#assign-products" className="inline-block text-xs underline underline-offset-2">
            Assign more products
          </Link>
        ) : null}
      </section>

      <section aria-label="Accounts" className="space-y-2">
        <h2 className="text-sm font-semibold">Customer accounts ({accounts.length})</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted">No account assigned yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white text-sm">
            {accounts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  <CustomerLink code={c.code} name={c.name} />
                  <span className="ml-2 text-xs text-muted">
                    {c.code}
                    {c.city ? ` · ${c.city}` : ""}
                  </span>
                </span>
                {manage ? (
                  <form action={assignAccountAction}>
                    <input type="hidden" name="customerId" value={c.id} />
                    <input type="hidden" name="personId" value="" />
                    <button type="submit" className="text-xs text-bad underline underline-offset-2">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {manage ? (
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-sm font-medium">Add an account</p>
            <form method="get" className="mt-2 flex flex-wrap gap-2">
              <input name="q" defaultValue={search} placeholder="Search customer name or code" maxLength={80} className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm md:max-w-xs" aria-label="Search customers without a sales person" />
              <button type="submit" className={small}>
                Search
              </button>
            </form>
            {candidates.length === 0 ? (
              <p className="mt-2 text-xs text-muted">{search ? "No unassigned customer matches." : "Every customer already has a sales person, or no customers were imported yet."}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {candidates.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span>
                      {c.name}
                      <span className="ml-2 text-xs text-muted">
                        {c.code}
                        {c.city ? ` · ${c.city}` : ""}
                      </span>
                    </span>
                    <form action={assignAccountAction}>
                      <input type="hidden" name="customerId" value={c.id} />
                      <input type="hidden" name="personId" value={person.id} />
                      <button type="submit" className={small} disabled={!person.active}>
                        Add
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {candidates.length === 25 ? <p className="mt-2 text-xs text-muted">Showing the first 25. Search to narrow the list.</p> : null}
          </div>
        ) : null}
      </section>

      <section aria-label="Tenders" className="space-y-2">
        <h2 className="text-sm font-semibold">Tenders ({tenderList.length})</h2>
        {tenderList.length === 0 ? (
          <p className="text-sm text-muted">No tender assigned yet. The owner is chosen on each tender&rsquo;s page.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white text-sm">
            {tenderList.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                <Link href={`/tenders/${t.id}`} className="underline decoration-line underline-offset-2 hover:decoration-brand">
                  {t.title}
                </Link>
                <span className="text-xs text-muted">
                  {t.authority} · {STATUS_LABEL[t.status as TenderStatus]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
