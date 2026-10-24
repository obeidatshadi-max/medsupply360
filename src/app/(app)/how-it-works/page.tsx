import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { CHANNELS, CHANNEL_INFO } from "@/core/channels";
import { ROLES, ROLE_LABEL } from "@/core/permissions";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "How it works" };

const SCREENS: [string, string][] = [
  ["Owner overview", "Four things to check first: sales and margin, cash, unpaid invoices and stock."],
  ["Products & suppliers", "Where demand is growing, by therapeutic area and customer type."],
  ["Sales & accounts", "Sales, gross profit and balances per customer."],
  ["Inventory & supply", "Slow stock and stock that may expire before it is sold."],
  ["Finance & profitability", "Sales and margin by line, cash collected and the age of unpaid invoices."],
  ["Management actions", "Customers late to reorder or pay, and the tracker of follow-ups you assign."],
  ["Installed base", "Machines at customers and whether the customers buy the consumables they should."],
  ["Service & support", "Which machines are under a service contract and which are a contract to sell."],
  ["Support functions", "A few indicators per supporting department, typed in by a person."],
  ["Opportunity radar", "Where to look first for growth. Signals to investigate, never a forecast."],
  ["Tenders", "Every tender from the first sign of a purchase to the money collected."],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm">{children}</div>
    </section>
  );
}

export default async function HowItWorksPage() {
  await requireUser("any");
  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Guide" title="How this control tower works" sub="A short guide to where the numbers come from, how to read them, and what each person can do." />

      <Section title="What it does">
        <p>It shows the owner how the business is doing, using only what has been loaded into it. It does not connect to the accounting system live: files are loaded by a person, and every screen says how recent its data is.</p>
        <p>A figure marked ESTIMATE is a guess from history, such as a customer who is late to reorder. A dash (—) means the figure cannot be worked out yet, for example because a file is missing.</p>
      </Section>

      <Section title="Where the data comes from: three channels">
        <ul className="list-disc space-y-1 pl-5">
          {CHANNELS.map((c) => (
            <li key={c}>
              <b>{CHANNEL_INFO[c].title}.</b> {CHANNEL_INFO[c].summary} Fed by: {CHANNEL_INFO[c].feeder.toLowerCase()}, {CHANNEL_INFO[c].cadence.toLowerCase()}.
            </li>
          ))}
        </ul>
        <p>
          The owner opens <Link href="/imports" className="text-brand underline underline-offset-2">Data</Link>, drops an Excel or CSV file, checks what the tool understood, and confirms. Nothing is saved until then.
        </p>
      </Section>

      <Section title="Reading a figure">
        <ul className="list-disc space-y-1 pl-5">
          <li>Sales and cash figures carry the period they cover. Year-to-date windows end at the newest invoice, so an old import is never compared with a longer last year.</li>
          <li>Amounts are in Jordanian dinars, without tax, after taking off returns.</li>
          <li>Gross margin uses only the sales that have a product cost, and says what share of sales that covers.</li>
          <li>Several signals can point at the same customer, so the app never adds them into one opportunity value.</li>
        </ul>
      </Section>

      <Section title="The screens">
        <dl className="grid gap-x-6 gap-y-1 md:grid-cols-[14rem_1fr]">
          {SCREENS.map(([name, text]) => (
            <div key={name} className="contents">
              <dt className="font-medium">{name}</dt>
              <dd className="text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Tools in the top bar">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Basic | Advanced.</b> Basic keeps the menu short. Advanced adds tenders, installed base, service, support functions and the opportunity radar. The data is the same.</li>
          <li><b>Search current view.</b> Narrows the rows and cards of the screen you are reading.</li>
          <li><b>Export.</b> Downloads what the screen shows as a CSV file for Excel, following the search and the line filter.</li>
          <li><b>All lines | Equipment | Devices | Consumables.</b> On the screens that can be split by product line. Cash, unpaid invoices and tenders cannot, and those screens say so.</li>
        </ul>
      </Section>

      <Section title="Who can do what">
        <dl className="grid gap-x-6 gap-y-1 md:grid-cols-[14rem_1fr]">
          {ROLES.map((r) => (
            <div key={r} className="contents">
              <dt className="font-medium">{ROLE_LABEL[r].name}</dt>
              <dd className="text-muted">{ROLE_LABEL[r].note}</dd>
            </div>
          ))}
        </dl>
        <p>Every change someone makes asks for their name and is listed with the date and time in the Update history.</p>
      </Section>

      <Section title="What it does not claim">
        <ul className="list-disc space-y-1 pl-5">
          <li>It is not an accounting report. Check the numbers with your accountant before relying on them for a decision.</li>
          <li>A purchasing gap, an old machine or a missing contract is a reason to ask a question, not proof of a lost sale.</li>
          <li>Marking an action done means a person confirmed it. It does not prove money was recovered.</li>
          <li>Support-function indicators are typed in. The app does not measure them.</li>
        </ul>
      </Section>
    </div>
  );
}
