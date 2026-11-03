import { landingFor, type LandingLocale } from "@/lib/landing/copy";

/**
 * The promotional demo's front page. It reads the same copy as the app's front page (src/lib/landing/copy.ts), so the
 * two say the same thing; only the buttons differ: the demo has no sign-in, so its call to action opens the demo.
 * Plain HTML and CSS because the demo is one static file (scripts/build-demo.mjs inlines this module).
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const DEMO_TEXT: Record<LandingLocale, { enter: string; notice: string; footerNote: string }> = {
  en: { enter: "Enter the demo", notice: "Demonstration on made-up data", footerNote: "This is a demonstration. Every account and figure is made up." },
  ar: { enter: "ادخل العرض التجريبي", notice: "عرض تجريبي على بيانات من وحي الخيال", footerNote: "هذا عرض تجريبي. كل الحسابات والأرقام من وحي الخيال." },
};

const ICON_PATHS = {
  check: "M5 12l4 4 10-10",
  arrow: "M5 12h14M13 6l6 6-6 6",
  pillars: [
    "M3 17l5-6 4 4 8-9M14 6h6v6",
    "M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h5",
    "M4 7h16v10H4zM9 21h6M12 17v4M8 11h.01M12 11h4",
    "M12 3l9 16H3zM12 10v4M12 17h.01",
    "M5 12l4 4 10-10M4 20h16",
  ],
  journey: [
    "M12 3v12M7 10l5 5 5-5M4 20h16",
    "M4 4h16v16H4zM8 12l3 3 5-6",
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z",
    "M4 20V10M10 20V4M16 20v-7M22 20H2",
    "M5 12h14M13 6l6 6-6 6",
    "M12 7v5l3 2M21 12a9 9 0 11-3-6.7M21 4v5h-5",
  ],
};

const icon = (d: string, cls = "") =>
  `<svg class="lp-ico ${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

export function landingHtml(locale: LandingLocale): string {
  const c = landingFor(locale);
  const d = DEMO_TEXT[locale];
  const rtl = locale === "ar";
  const other = rtl ? "en" : "ar";
  const p = c.preview;
  const stats = p.stats
    .map((s) => `<section class="lp-tile"><h3>${esc(s.label)}</h3><p class="lp-fig" dir="ltr">${esc(s.value)}</p><p class="lp-note">${esc(s.note)}</p></section>`)
    .join("");
  const priorities = p.priorities
    .map((x) => `<li><span class="lp-dot ${x.tone}" aria-hidden="true"></span><span class="lp-grow">${esc(x.title)}</span><b dir="ltr">${esc(x.value)}</b></li>`)
    .join("");
  const lines = p.lines
    .map((l) => `<li><div class="lp-row"><span>${esc(l.name)}</span><b dir="ltr">${l.share}%</b></div><div class="lp-bar" dir="ltr"><span style="width:${l.share * 2}%"></span></div></li>`)
    .join("");
  const pillars = c.pillars.items
    .map((it, i) => `<li class="lp-card ${i >= 3 ? "wide" : ""}"><span class="lp-badge">${icon(ICON_PATHS.pillars[i])}</span><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p></li>`)
    .join("");
  const steps = c.journey.steps
    .map((s, i) => `<li class="lp-step"><span class="lp-stepicon">${icon(ICON_PATHS.journey[i])}</span><p class="lp-num">${i + 1}</p><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`)
    .join("");
  const items = c.how.items
    .map((f) => `<li class="lp-mini">${icon(ICON_PATHS.check, "gold")}<h3>${esc(f.title)}</h3><p>${esc(f.body)}</p></li>`)
    .join("");
  const iMax = Math.max(...c.intel.buckets.map((b) => b.count), 1);
  const intelItems = c.intel.items
    .map((it) => `<li><h3>${icon(ICON_PATHS.check, "gold")}<span>${esc(it.title)}</span></h3><p>${esc(it.body)}</p></li>`)
    .join("");
  const intelBars = c.intel.buckets
    .map((b, i) => `<li><div class="lp-row"><span>${esc(b.label)}</span><b dir="ltr">${b.count}</b></div><div class="lp-bar ${i === 0 ? "" : "gold"}" dir="ltr"><span style="width:${(b.count / iMax) * 100}%"></span></div></li>`)
    .join("");
  const points = c.hero.points.map((pt) => `<li>${icon(ICON_PATHS.check, "soft")}${esc(pt)}</li>`).join("");
  return `<div class="lp" lang="${locale}" dir="${rtl ? "rtl" : "ltr"}">
<section class="lp-hero">
<header class="lp-top"><p class="lp-logo"><span class="lp-mark" aria-hidden="true">360</span><span><b dir="ltr">${esc(c.brand)}</b><small>${esc(c.strap)}</small></span></p>
<nav aria-label="${esc(c.nav.label)}"><a href="#lp-how" class="lp-hide">${esc(c.nav.how)}</a><a href="#lp-pillars" class="lp-hide">${esc(c.nav.pillars)}</a><a href="#lp-intel" class="lp-hide">${esc(c.nav.intel)}</a><button type="button" class="lp-link" data-landing-lang="${other}" lang="${other}">${esc(c.nav.language)}</button><button type="button" class="lp-ghost" data-landing-enter>${esc(d.enter)}</button></nav></header>
<div class="lp-herogrid"><div>
<p class="lp-pill">${esc(d.notice)}</p>
<h1>${esc(c.hero.title)}</h1><p class="lp-sub">${esc(c.hero.subtitle)}</p><p class="lp-body">${esc(c.hero.body)}</p>
<div class="lp-cta"><button type="button" class="lp-gold" data-landing-enter>${esc(d.enter)}${icon(ICON_PATHS.arrow, "flip")}</button><a class="lp-outline" href="#lp-how">${esc(c.hero.secondary)}</a></div>
<ul class="lp-points">${points}</ul></div>
<div role="group" aria-label="${esc(p.title)}. ${esc(p.sample)}" class="lp-preview"><div class="lp-prevhead"><b>${esc(p.title)}</b><span>${esc(p.sample)}</span></div>
<div class="lp-stats">${stats}</div>
<div class="lp-pair"><section class="lp-tile"><h3 class="lp-cap">${esc(p.priorityTitle)}</h3><ul class="lp-prio">${priorities}</ul></section><section class="lp-tile"><h3 class="lp-cap">${esc(p.linesTitle)}</h3><ul class="lp-lines">${lines}</ul></section></div></div>
</div></section>
<section id="lp-pillars" class="lp-sec"><h2>${esc(c.pillars.title)}</h2><ul class="lp-cards">${pillars}</ul></section>
<section id="lp-intel" class="lp-sec lp-intelsec"><div class="lp-intel"><div><h2>${esc(c.intel.title)}</h2><p class="lp-lead">${esc(c.intel.subtitle)}</p><ul class="lp-intelitems">${intelItems}</ul></div><div role="group" aria-label="${esc(c.intel.chartTitle)}. ${esc(c.intel.chartSample)}" class="lp-chart"><div class="lp-prevhead"><b>${esc(c.intel.chartTitle)}</b><span>${esc(c.intel.chartSample)}</span></div><ul class="lp-lines">${intelBars}</ul><p class="lp-note lp-chartnote">${esc(c.intel.chartNote)}</p></div></div></section>
<section class="lp-tint"><div class="lp-sec"><h2>${esc(c.journey.title)}</h2><p class="lp-lead">${esc(c.journey.subtitle)}</p><ol class="lp-steps">${steps}</ol></div></section>
<section id="lp-how" class="lp-sec"><h2>${esc(c.how.title)}</h2><p class="lp-lead">${esc(c.how.subtitle)}</p><ul class="lp-minis">${items}</ul></section>
<section class="lp-close"><div class="lp-closein"><div><h2>${esc(c.close.title)}</h2><p>${esc(d.footerNote)}</p></div><button type="button" class="lp-gold" data-landing-enter>${esc(d.enter)}${icon(ICON_PATHS.arrow, "flip")}</button></div></section>
<footer class="lp-foot"><span>${esc(c.footer.line)}</span><span>${esc(c.footer.audience)}</span></footer>
</div>`;
}

/** Scoped under .lp so nothing in the demo shell is affected. Shown only while body has the class `landing-on`. */
export const LANDING_CSS = `
body.landing-on .shell,body.landing-on .mobilebar,body.landing-on .navshade,body.landing-on .demo-banner{display:none!important}
body.landing-on{padding-bottom:0!important}
#landing{display:none}body.landing-on #landing{display:block}
.lp{--g:#176e60;--gd:#0c3b33;--gs:#e8f2ed;--au:#b18b42;--aus:#d3b77e;--ink:#233534;--mu:#566663;--ln:#dfe6e2;color:var(--ink);background:#f3f5f2;font:16px/1.55 Arial,Helvetica,sans-serif}
.lp[dir=rtl]{font-family:"Segoe UI",Tahoma,Arial,sans-serif}
.lp *{box-sizing:border-box}.lp :where(h1,h2,h3,p,ul,ol){margin:0;padding:0}.lp :where(ul,ol){list-style:none}
.lp button{font:inherit;cursor:pointer}.lp a{color:inherit;text-decoration:none}
.lp :focus-visible{outline:3px solid var(--aus);outline-offset:3px}
.lp-ico{width:20px;height:20px;flex:none}.lp-ico.gold{color:var(--au);width:16px;height:16px}.lp-ico.soft{color:var(--aus);width:16px;height:16px}
[dir=rtl] .lp-ico.flip{transform:scaleX(-1)}
.lp-hero{background:linear-gradient(135deg,#176e60,#135c50 55%,#0c3b33);color:#fff;position:relative;overflow:hidden}
.lp-hero::before{content:"";position:absolute;inset:0;opacity:.06;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:44px 44px;pointer-events:none}
.lp-top,.lp-herogrid,.lp-sec,.lp-closein,.lp-foot{max-width:1152px;margin:0 auto;padding-inline:24px;position:relative}
.lp-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding-block:16px}
.lp-logo{display:flex;align-items:center;gap:10px}.lp-logo b{display:block;font-size:18px;font-weight:600}.lp-logo small{display:block;font-size:11px;color:#ffffffbf}
.lp-mark{background:var(--aus);color:#10332c;border-radius:8px;width:36px;height:36px;display:grid;place-items:center;font-size:13px;font-weight:700}
.lp .lp-top nav{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;font-size:14px;overflow:visible;min-height:0}
.lp nav a,.lp nav button{display:inline-flex;align-items:center;width:auto;margin:0;gap:0}
.lp nav a,.lp nav .lp-link{color:#ffffffd9;background:none;border:0;padding:0;border-radius:0}.lp nav a:hover,.lp nav .lp-link:hover{color:#fff;background:none}
.lp nav .lp-ghost{min-height:40px;padding:0 16px;border-radius:8px;border:1px solid #ffffff66;background:transparent;color:#fff;font-weight:600}.lp nav .lp-ghost:hover{background:#ffffff1a;border-color:#ffffff66}
.lp-herogrid{display:grid;gap:40px;padding-block:32px 80px;grid-template-columns:1fr}
.lp-pill{display:inline-block;background:#ffffff1f;border:1px solid #ffffff40;border-radius:999px;padding:3px 12px;font-size:12px;margin-bottom:18px}
.lp h1{font-size:40px;line-height:1.15;font-weight:600;letter-spacing:-.02em}
.lp-sub{margin-top:20px!important;font-size:22px;line-height:1.35;font-weight:500;color:#e6d3a8}
.lp-body{margin-top:16px!important;max-width:560px;color:#ffffffd9}
.lp-cta{margin-top:32px;display:flex;flex-wrap:wrap;gap:12px}
.lp-gold,.lp-outline{min-height:48px;padding:0 24px;border-radius:8px;font-weight:600;font-size:16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s}
.lp-gold{background:var(--aus);color:#10332c;border:0}.lp-gold:hover{background:#e2cb98}.lp-gold:active,.lp-outline:active{transform:scale(.98)}
.lp-outline{border:1px solid #ffffff73;color:#fff}.lp-outline:hover{background:#ffffff1a}
.lp-points{margin-top:32px;display:flex;flex-wrap:wrap;gap:8px 20px;font-size:14px;color:#ffffffcc}.lp-points li{display:flex;align-items:center;gap:6px}
.lp-preview{background:#f3f5f2;color:var(--ink);border:1px solid #ffffff33;border-radius:16px;padding:16px;box-shadow:0 25px 50px -12px #00000066}
.lp-prevhead{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:14px}
.lp-prevhead span{background:#f1e6cc;color:#6b5314;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600}
.lp-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lp-pair{display:grid;gap:10px;margin-top:10px;grid-template-columns:1.2fr 1fr}
.lp-tile{background:#fff;border:1px solid var(--ln);border-radius:12px;padding:12px}.lp-tile h3{font-size:11px;font-weight:400;color:var(--mu);line-height:1.35}
.lp-cap{text-transform:uppercase;letter-spacing:.08em;font-weight:600!important}
.lp-fig{margin-top:4px!important;font-size:20px;font-weight:600;letter-spacing:-.01em}[dir=rtl] .lp-fig{text-align:end}.lp-note{font-size:11px;color:var(--mu);margin-top:2px!important;line-height:1.35}
.lp-prio,.lp-lines{margin-top:8px;display:grid;gap:8px;font-size:12px}.lp-prio li{display:flex;gap:8px;align-items:flex-start}.lp-grow{flex:1}
.lp-dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex:none;background:var(--g)}.lp-dot.bad{background:#a44d42}
.lp-row{display:flex;justify-content:space-between}.lp-bar{height:8px;border-radius:99px;background:var(--gs);margin-top:4px;overflow:hidden}.lp-bar span{display:block;height:100%;background:var(--g);border-radius:99px}
.lp-sec{padding-block:64px}.lp h2{font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-.01em;color:#10332c}
.lp-lead{margin-top:8px!important;max-width:640px;color:var(--mu)}
.lp-cards{margin-top:32px;display:grid;gap:16px;grid-template-columns:repeat(6,1fr)}
.lp-card{grid-column:span 2;background:#fff;border:1px solid var(--ln);border-radius:16px;padding:20px;box-shadow:0 1px 2px #0000000d}.lp-card.wide{grid-column:span 3}
.lp-badge{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--gs);color:var(--g)}
.lp-card h3{margin-top:16px!important;font-size:18px;font-weight:600;color:#10332c}.lp-card p{margin-top:8px!important;font-size:14px;color:var(--mu)}
.lp-tint{background:#e8f2edb3}.lp-steps{margin-top:40px;display:grid;gap:24px 12px;grid-template-columns:repeat(6,1fr)}
.lp-step{position:relative}.lp-step:not(:last-child)::after{content:"";position:absolute;inset-inline-start:56px;top:20px;height:1px;width:calc(100% - 40px);background:var(--au)}
.lp-stepicon{position:relative;z-index:1;width:40px;height:40px;border-radius:50%;background:var(--g);color:#fff;display:grid;place-items:center;box-shadow:0 0 0 4px #f1e6cc}
.lp-num{margin-top:12px!important;font-size:12px;font-weight:600;color:var(--mu)}.lp-step h3{font-size:16px;font-weight:600;color:#10332c}.lp-step p:last-child{margin-top:4px!important;font-size:14px;color:var(--mu)}
.lp-minis{margin-top:32px;display:grid;gap:12px;grid-template-columns:repeat(4,1fr)}
.lp-mini{background:#fff;border:1px solid var(--ln);border-radius:12px;padding:16px}.lp-mini h3{margin-top:8px!important;font-size:14px;font-weight:600;color:#10332c}.lp-mini p{margin-top:4px!important;font-size:14px;color:var(--mu)}
.lp-close{background:var(--gd);color:#fff;padding-block:56px}.lp-closein{display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between}
.lp-close h2{color:#fff}.lp-close p{margin-top:8px!important;color:#ffffffcc;max-width:560px}
.lp-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;padding-block:24px;font-size:12px;color:var(--mu)}
.lp-intelsec{padding-block:0 64px}.lp-intel{display:grid;gap:32px;grid-template-columns:1fr;background:#fff;border:1px solid var(--ln);border-radius:24px;padding:32px;box-shadow:0 1px 2px #0000000d}
.lp-intelitems{margin-top:24px;display:grid;gap:16px;grid-template-columns:1fr 1fr}.lp-intelitems h3{display:flex;gap:8px;align-items:flex-start;font-size:14px;font-weight:600;color:#10332c}.lp-intelitems h3 .lp-ico{margin-top:2px}.lp-intelitems p{margin-top:4px!important;font-size:14px;color:var(--mu)}
.lp-chart{align-self:start;background:#f3f5f2;border:1px solid var(--ln);border-radius:16px;padding:16px}.lp-chart .lp-lines{margin-top:16px;gap:12px}.lp-bar.gold span{background:var(--au)}.lp-chartnote{margin-top:16px!important;font-size:12px}
@media(min-width:1024px){.lp-intel{grid-template-columns:1.1fr 1fr;gap:40px}}
@media(max-width:640px){.lp-intel{padding:20px}.lp-intelitems{grid-template-columns:1fr}}
@media(min-width:1024px){.lp-herogrid{grid-template-columns:1.02fr 1fr;align-items:center;gap:48px}.lp h1{font-size:52px}.lp-sub{font-size:24px}}
@media(max-width:1023px){.lp-cards{grid-template-columns:1fr 1fr}.lp-card,.lp-card.wide{grid-column:auto}.lp-steps{grid-template-columns:1fr 1fr}.lp-step::after{display:none}.lp-minis{grid-template-columns:1fr 1fr}.lp nav .lp-hide{display:none}}
@media(max-width:640px){.lp-top,.lp-herogrid,.lp-sec,.lp-closein,.lp-foot{padding-inline:16px}.lp-cards,.lp-steps,.lp-minis{grid-template-columns:1fr}.lp-pair{grid-template-columns:1fr}.lp h1{font-size:34px}.lp-sec{padding-block:48px}.lp-herogrid{padding-bottom:56px}}
@media(prefers-reduced-motion:reduce){.lp-gold,.lp-outline{transition:none}}
`;
