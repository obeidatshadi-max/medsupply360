import Link from "next/link";
import { landingFor, type LandingLocale } from "@/lib/landing/copy";

/** Where "Try the demo" goes: the separate static site with made-up data. */
export const DEMO_URL = "https://sadaf-360-demo.netlify.app/";

const gold = "bg-gold-soft text-[#10332c] hover:bg-[#e2cb98]";
const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition duration-150 active:scale-[0.98]";

function Icon({ d, className = "size-5" }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

const PILLAR_ICONS = [
  "M3 17l5-6 4 4 8-9M14 6h6v6", // sales trend
  "M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h5", // tender document
  "M4 7h16v10H4zM9 21h6M12 17v4M8 11h.01M12 11h4", // device
  "M12 3l9 16H3zM12 10v4M12 17h.01", // risk
  "M5 12l4 4 10-10M4 20h16", // action done
];
const JOURNEY_ICONS = [
  "M12 3v12M7 10l5 5 5-5M4 20h16",
  "M4 4h16v16H4zM8 12l3 3 5-6",
  "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
  "M4 20V10M10 20V4M16 20v-7M22 20H2",
  "M5 12h14M13 6l6 6-6 6",
  "M12 7v5l3 2M21 12a9 9 0 11-3-6.7M21 4v5h-5",
];
const arrow = "M5 12h14M13 6l6 6-6 6";

/** The public front page. Static: it reads nothing from the database and shows no company figures. */
export function LandingPage({ locale, home = false }: { locale: LandingLocale; home?: boolean }) {
  const c = landingFor(locale);
  const rtl = locale === "ar";
  // Someone who came back to the front page from inside the workspace (the Home button) goes straight back; everyone else signs in.
  const enter = home ? "/dashboard" : "/login";
  const enterLabel = home ? c.nav.workspace : c.hero.primary;
  const p = c.preview;
  return (
    <div className="landing min-h-dvh" lang={locale} dir={rtl ? "rtl" : "ltr"}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-[#10332c]">
        {c.skip}
      </a>

      <section className="relative overflow-hidden bg-gradient-to-br from-brand via-[#135c50] to-[#0c3b33] text-white">
        <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-gold/15 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />

        <header className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-gold-soft text-sm font-bold text-[#10332c]">360</span>
            <span className="leading-tight">
              <span className="block text-lg font-semibold" dir="ltr">{c.brand}</span>
              <span className="block text-[11px] text-white/75">{c.strap}</span>
            </span>
          </p>
          <nav aria-label={c.nav.label} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <a href="#how" className="hidden text-white/85 hover:text-white md:inline">{c.nav.how}</a>
            <a href="#pillars" className="hidden text-white/85 hover:text-white md:inline">{c.nav.pillars}</a>
            <a href="#intel" className="hidden text-white/85 hover:text-white md:inline">{c.nav.intel}</a>
            <a href="#preview" className="hidden text-white/85 hover:text-white md:inline">{c.nav.preview}</a>
            <Link href={home ? `${c.nav.languageHref}?home=1` : c.nav.languageHref} lang={rtl ? "en" : "ar"} className="text-white/85 hover:text-white">{c.nav.language}</Link>
            <a href={DEMO_URL} className="hidden text-white/85 hover:text-white sm:inline">{c.nav.demo}</a>
            <Link href={enter} className="inline-flex min-h-10 items-center rounded-lg border border-white/40 px-4 font-medium hover:bg-white/10">{home ? c.nav.workspace : c.nav.signIn}</Link>
          </nav>
        </header>

        <div id="main" className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-8 sm:px-6 sm:pb-28 sm:pt-12 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-12">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-[3.3rem]">{c.hero.title}</h1>
            <p className="mt-5 text-xl font-medium leading-snug text-gold-soft sm:text-2xl">{c.hero.subtitle}</p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">{c.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={enter} className={`${btn} ${gold}`}>
                {enterLabel}
                <Icon d={arrow} className="size-4 rtl:rotate-180" />
              </Link>
              <a href="#how" className={`${btn} border border-white/45 text-white hover:bg-white/10`}>{c.hero.secondary}</a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/80">
              {c.hero.points.map((pt) => (
                <li key={pt} className="flex items-center gap-1.5">
                  <Icon d="M5 12l4 4 10-10" className="size-4 text-gold-soft" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div id="preview" className="scroll-mt-6">
            <div role="group" aria-label={`${p.title}. ${p.sample}`} className="rounded-2xl border border-white/20 bg-canvas p-3 text-ink shadow-2xl sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="rounded-full bg-[#f1e6cc] px-2.5 py-0.5 text-[11px] font-semibold text-[#6b5314]">{p.sample}</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {p.stats.map((s) => (
                  <section key={s.label} className="rounded-xl border border-line bg-white p-3">
                    <h3 className="text-[11px] leading-snug text-muted">{s.label}</h3>
                    <p dir="ltr" className={`mt-1 text-xl font-semibold tracking-tight ${rtl ? "text-end" : ""}`}>{s.value}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{s.note}</p>
                  </section>
                ))}
              </div>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1.2fr_1fr]">
                <section className="rounded-xl border border-line bg-white p-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{p.priorityTitle}</h3>
                  <ul className="mt-2 space-y-2">
                    {p.priorities.map((x) => (
                      <li key={x.title} className="flex items-start gap-2 text-xs">
                        <span aria-hidden className={`mt-1 size-2 shrink-0 rounded-full ${x.tone === "bad" ? "bg-bad" : "bg-brand"}`} />
                        <span className="flex-1">{x.title}</span>
                        <span dir="ltr" className="font-semibold">{x.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-xl border border-line bg-white p-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{p.linesTitle}</h3>
                  <ul className="mt-2 space-y-2">
                    {p.lines.map((l) => (
                      <li key={l.name} className="text-xs">
                        <div className="flex justify-between"><span>{l.name}</span><span dir="ltr" className="font-semibold">{l.share}%</span></div>
                        <div dir="ltr" className="mt-1 h-2 overflow-hidden rounded-full bg-brand-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${l.share * 2}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section id="pillars" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-[#10332c] sm:text-3xl">{c.pillars.title}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {c.pillars.items.map((it, i) => (
              <li key={it.title} className={`flex flex-col rounded-2xl border border-line bg-white p-5 shadow-sm lg:col-span-2 ${i >= 3 ? "lg:col-span-3" : ""}`}>
                <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon d={PILLAR_ICONS[i]} /></span>
                <h3 className="mt-4 text-lg font-semibold text-[#10332c]">{it.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[#566663]">{it.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="intel" className="mx-auto max-w-6xl scroll-mt-4 px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="grid gap-8 rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#10332c] sm:text-3xl">{c.intel.title}</h2>
              <p className="mt-2 text-base text-[#566663]">{c.intel.subtitle}</p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {c.intel.items.map((it) => (
                  <li key={it.title}>
                    <h3 className="flex items-start gap-2 text-sm font-semibold text-[#10332c]">
                      <Icon d="M5 12l4 4 10-10" className="mt-0.5 size-4 shrink-0 text-gold" />
                      {it.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#566663]">{it.body}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div role="group" aria-label={`${c.intel.chartTitle}. ${c.intel.chartSample}`} className="self-start rounded-2xl border border-line bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#10332c]">{c.intel.chartTitle}</h3>
                <p className="rounded-full bg-[#f1e6cc] px-2.5 py-0.5 text-[11px] font-semibold text-[#6b5314]">{c.intel.chartSample}</p>
              </div>
              <ul className="mt-4 space-y-3">
                {c.intel.buckets.map((b, i) => {
                  const max = Math.max(...c.intel.buckets.map((x) => x.count));
                  return (
                    <li key={b.label} className="text-xs">
                      <div className="flex justify-between gap-3"><span>{b.label}</span><b dir="ltr">{b.count}</b></div>
                      <div dir="ltr" className="mt-1 h-2.5 overflow-hidden rounded-full bg-brand-soft"><div className={`h-full rounded-full ${i === 0 ? "bg-brand" : "bg-gold"}`} style={{ width: `${max ? (b.count / max) * 100 : 0}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-[#566663]">{c.intel.chartNote}</p>
            </div>
          </div>
        </section>

        <section className="bg-brand-soft/70 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[#10332c] sm:text-3xl">{c.journey.title}</h2>
            <p className="mt-2 max-w-2xl text-base text-[#566663]">{c.journey.subtitle}</p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
              {c.journey.steps.map((s, i) => (
                <li key={s.title} className="relative">
                  {i < c.journey.steps.length - 1 ? <span aria-hidden className="absolute start-14 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-gold lg:block" /> : null}
                  <span className="relative grid size-10 place-items-center rounded-full bg-brand text-white ring-4 ring-[#f1e6cc]"><Icon d={JOURNEY_ICONS[i]} /></span>
                  <p className="mt-3 text-xs font-semibold text-[#566663]">{i + 1}</p>
                  <h3 className="text-base font-semibold text-[#10332c]">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#566663]">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-[#10332c] sm:text-3xl">{c.how.title}</h2>
          <p className="mt-2 max-w-2xl text-base text-[#566663]">{c.how.subtitle}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.how.items.map((f) => (
              <li key={f.title} className="rounded-xl border border-line bg-white p-4">
                <Icon d="M5 12l4 4 10-10" className="size-4 text-gold" />
                <h3 className="mt-2 text-sm font-semibold text-[#10332c]">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#566663]">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-[#0c3b33] py-14 text-white sm:py-16">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 sm:px-6">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.close.title}</h2>
              <p className="mt-2 text-base text-white/80">{c.close.body}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={enter} className={`${btn} ${gold}`}>
                {home ? c.nav.workspace : c.close.cta}
                <Icon d={arrow} className="size-4 rtl:rotate-180" />
              </Link>
              <a href={DEMO_URL} className={`${btn} border border-white/45 text-white hover:bg-white/10`}>{c.nav.demo}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-[#566663] sm:px-6">
        <p>{c.footer.line}</p>
        <p>{c.footer.audience}</p>
      </footer>
    </div>
  );
}
