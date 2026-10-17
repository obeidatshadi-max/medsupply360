import { customerProfileStore, demoActionKey, normalizeCustomerProfile, profileDraftFromText, type CustomerProfile } from "./customer-profiles";
import { checkDemoImport, currentAppTemplate, demoProductReorders, demoReadiness, SNAPSHOT_BAD_SAMPLE, SNAPSHOT_SAMPLE } from "./prediction-demo";
import { SPECS, type ImportKind } from "@/core/import/specs";
import { DEMO_AS_OF } from "./dataset";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const box = (title: string, sub: string, body: string) => `<section class="panel"><h2>${title}</h2><p class="sub">${sub}</p>${body}</section>`;
const table = (headers: string[], rows: string[][]) => `<div class="tablewrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v, i) => `<td data-label="${esc(headers[i])}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

interface Action { id: string; title: string; owner: string; due: string; status: string; evidence: string }
interface Hooks {
  applyContext(profile: CustomerProfile): void;
  setActions(actions: Action[]): void;
  defaultActions(): Action[];
  render(): void;
  goProfile(): void;
  toast(message: string): void;
  sadafSuppliers: string[];
}

/** All company profiles and actions stay in this browser; the public site is a reusable presentation shell. */
export function createCustomerPresentation(hooks: Hooks) {
  let storage: Storage | undefined;
  try { storage = window.localStorage; } catch { /* session-only operation still works */ }
  const store = customerProfileStore(storage);
  let draft: Partial<CustomerProfile> | null = null;
  let newDraft = false;
  let revision = 0;
  let profileStatus = "";
  let checkKind: ImportKind = "stock_snapshot";
  let checkResult = "";
  const snapshots = new Map<string, number>();
  const sessionActions = new Map<string, Action[]>();
  const fields = [
    ["name", "Company name"], ["location", "Country / location"], ["founded", "Established"], ["team", "Team size and source date"],
    ["address", "Address"], ["erp", "Accounting / ERP system"], ["source", "Profile source and date"],
    ["audience", "Customers served"], ["purpose", "Business description"], ["suppliers", "Suppliers / brands (one per line)"], ["notes", "Context and items to confirm"],
  ] as const;

  const profile = () => {
    const p = store.active();
    return p.id === "sadaf" ? { ...p, suppliers: hooks.sadafSuppliers } : p;
  };
  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a"); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function activate() {
    revision++;
    const p = profile();
    let actions = sessionActions.get(p.id);
    if (!actions) {
      try { const saved = JSON.parse(storage?.getItem(demoActionKey(p.id)) || "null"); if (Array.isArray(saved)) actions = saved; } catch { /* use samples */ }
    }
    if (!actions) actions = p.id === "sadaf" ? hooks.defaultActions() : [
      { id: "DEMO-1", title: "Review repeat consumable orders", owner: "Sales manager", due: "2026-10-15", status: "Open", evidence: "Synthetic purchase history; confirm the customer's stock and usage." },
      { id: "DEMO-2", title: "Review sample expiry exposure", owner: "Operations manager", due: "2026-10-15", status: "Open", evidence: "Sample stock only; validate batch dates and demand." },
    ];
    hooks.setActions(actions);
    hooks.applyContext(p);
    const name = p.name;
    document.title = `${name} 360 · Customer demonstration`;
    const brand = document.querySelector(".brand");
    if (brand) brand.innerHTML = `${esc(name === "Sadaf Medical Supplies" ? "SADAF" : name)}<span>360</span><small>CUSTOMER DEMONSTRATION</small>`;
    const aside = document.querySelector(".asidebottom");
    if (aside) aside.innerHTML = `<span class="avatar">${esc(name.slice(0, 2).toUpperCase())}</span><b>${esc(name)} workspace</b><div style="margin-top:12px">${esc(p.location || "Location not supplied")}<br>Sample business records</div>`;
    const banner = document.querySelector(".demo-banner");
    if (banner) banner.innerHTML = `<span><b>${esc(name)}</b> · ${esc(p.source || "Presenter-supplied profile")}</span><span>Company profile context · Financial and operational figures are synthetic</span>`;
    const crumb = document.querySelector(".crumb");
    if (crumb) crumb.innerHTML = `${esc(name)} / <b id="crumb"></b>`;
    const tools = document.querySelector(".toptools");
    if (tools && !document.querySelector("#customer-switch")) {
      const button = document.createElement("button"); button.id = "customer-switch"; button.textContent = "Change company";
      button.onclick = hooks.goProfile; tools.prepend(button);
    }
    hooks.render();
  }

  function companyPanel() {
    const p = profile(), edit = draft ?? p;
    const form = fields.map(([key, label]) => {
      const value = key === "suppliers" ? (edit.suppliers ?? []).join("\n") : edit[key] ?? "";
      return `<label for="profile-${key}">${label}${["audience", "purpose", "suppliers", "notes"].includes(key)
        ? `<textarea id="profile-${key}" name="${key}" rows="3" maxlength="${key === "notes" ? 4000 : 14000}">${esc(value)}</textarea>`
        : `<input id="profile-${key}" name="${key}" value="${esc(value)}" ${key === "name" ? "required" : ""} maxlength="${key === "name" ? 160 : 1000}">`}</label>`;
    }).join("");
    return box("Customer presentation profiles", "Choose a customer before a visit. Profile facts personalize the presentation; sample accounts and figures stay clearly labelled.",
      `<label for="customer-picker">Saved company<select id="customer-picker">${store.list().map((r) => `<option value="${esc(r.id)}" ${r.id === p.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
      <div class="profile-actions"><button id="profile-new">New customer</button><button id="profile-export">Export current profile JSON</button><button id="profile-sadaf">Use original Sadaf example</button></div>
      <p class="mini">Saved in this browser. Export/import the profile JSON to use it on another computer. Uploaded documents are read locally and are not sent to a server.</p>
      <p id="profile-status" role="status">${esc(profileStatus)}${!store.persistent() ? " Browser storage is unavailable; changes last for this session. Export the profile before closing." : ""}</p>`)
      + box("Load or edit the company profile", "Import a PDF, text file or saved profile JSON, then review the draft before saving. Scanned PDFs need pasted OCR text or manual entry.",
      `<label for="profile-file">Company profile file<input id="profile-file" type="file" accept=".pdf,.txt,.json,application/pdf,text/plain,application/json"></label>
      <details><summary>Paste company profile text</summary><textarea id="profile-text" rows="5" maxlength="60000" aria-label="Company profile text"></textarea><button id="profile-extract" type="button">Prepare draft from text</button></details>
      <form id="profile-form" class="customer-profile-form"><div class="profile-fields">${form}</div><div class="profile-actions">
      ${p.id !== "sadaf" && !newDraft ? '<button class="primary" type="submit" name="mode" value="update">Save changes to this customer</button>' : ""}
      <button type="submit" name="mode" value="new">Save as new customer</button></div></form>`)
      + box(esc(p.name), esc(p.source || "Presenter-supplied company context"),
      table(["Profile fact", "Supplied value"], [["Location", p.location || "Not supplied"], ["Established", p.founded || "Not supplied"], ["Team", p.team || "Not supplied"],
        ["Address", p.address || "Not supplied"], ["Customers served", p.audience || "Not supplied"], ["Business description", p.purpose || "Not supplied"], ["ERP", p.erp || "Not supplied"], ["Notes", p.notes || "Not supplied"]])
      + `<p class="mini">The profile does not establish revenue, margin, actual customer accounts, stock or current supplier contracts.</p><div class="brandchips">${p.suppliers.map((s) => `<span>${esc(s)}</span>`).join("") || "No supplier names supplied."}</div>`);
  }

  function productPanel(query = "") {
    const r = demoProductReorders();
    const rows = r.items.filter((x) => x.forecast.level !== "On cycle" && JSON.stringify(x).toLowerCase().includes(query.toLowerCase()));
    return box("Repeat consumables by customer and product", `Illustrative estimates for ${esc(profile().name)} · snapshot ${DEMO_AS_OF}. Same median-cycle calculation as MedSupply360.`,
      `<p>${r.eligiblePairs} customer/product pairs have enough history; ${r.insufficientHistory} have too few order days. Private consumables only; tender and unclassified accounts are excluded.</p>`
      + table(["Customer / product", "Status", "Last order", "Expected date", "Typical quantity", "Pattern consistency"], rows.map((x) => [
        `${x.customerName} / ${x.productName}`, x.forecast.level, x.forecast.lastOrder, x.forecast.expectedNext, `${x.typicalQuantity} ${x.unit}`, x.forecast.confidence === "Higher" ? "More regular" : "Less regular",
      ])) + `<p class="mini">The sample hospital bought product B recently, but product A remains overdue. Buying another product does not reset its cycle. These are historical estimates, not trained AI probabilities. This small teaching sample is separate from the year-to-date totals.</p>`);
  }

  function readinessPanel() {
    return box("Data for predictions", "Illustrative import history for this presentation—not the company's actual imports.",
      table(["Source", "Last sample load", "Snapshot", "Load result", "Latest attempt"], demoReadiness().map((d) => [d.title, d.loadedOn ?? "Never loaded", d.snapshotDate ?? "—", d.load, d.attempt]))
      + `<p class="mini">Example gaps: one unclassified customer, one product without a unit, partial sales and missing receipts/movements. A rejected upload does not refresh the last-loaded date. Real readiness requires mapped exports, consistent units, complete history and accountant reconciliation.</p>`);
  }

  function importPanel() {
    const qty = snapshots.get(profile().id) ?? 10;
    return box("Current MedSupply360 import checks", "Uses the working app's CSV parser and field mapping. This demo checks files locally; it does not save business records or replace sample dashboard values.",
      `<label for="app-import-kind">Current app file type<select id="app-import-kind">${Object.entries(SPECS).map(([k, s]) => `<option value="${k}" ${k === checkKind ? "selected" : ""}>${esc(s.title)}</option>`).join("")}</select></label>
      <label for="app-import-file">Check a CSV file<input id="app-import-file" type="file" accept=".csv,text/csv"></label>
      <div class="profile-actions"><button id="app-template">Download current app sample CSV</button><button id="app-template-check">Check selected sample</button></div>
      <p class="mini">Up to 4.5 MB. Snapshot date for this teaching example: ${DEMO_AS_OF}. These are format checks; cross-file references and accounting totals still require the real app and reconciliation.</p>
      <div class="profile-actions"><button id="snapshot-good">Try complete stock snapshot</button><button id="snapshot-bad">Try rejected replacement</button></div>
      <p id="snapshot-value">Retained sample stock: <b>${qty} units</b></p><div id="app-import-result" role="status">${checkResult}</div>`);
  }
  function showCheck(raw: string, kind = checkKind, simulate = false) {
    const r = checkDemoImport(kind, raw);
    if (simulate && !r.blocked) snapshots.set(profile().id, Number(r.accepted[0]?.values.quantity ?? 10));
    checkResult = `<div class="info"><b>${r.blocked ? SPECS[kind].snapshot ? "Replacement blocked: prior sample retained" : "File check blocked: nothing loaded" : `${r.readyRows} rows pass file checks`}</b>
      ${r.fatal ? `<p>${esc(r.fatal)}</p>` : ""}${r.rejected.map((i) => `<p>Row ${i.row}: ${esc(i.reason)}</p>`).join("")}
      ${table(["App field", "Matched source column"], r.mappedColumns.map((m) => [m.field, m.sourceColumn]))}
      <p>Stock and unpaid snapshots must pass in full. Ambiguous columns are blocked. Raw file contents are not stored; dashboard figures remain synthetic.</p></div>`;
    const result = document.querySelector("#app-import-result"); if (result) result.innerHTML = checkResult;
    const value = document.querySelector("#snapshot-value"); if (value) value.textContent = `Retained sample stock: ${snapshots.get(profile().id) ?? 10} units`;
  }
  function fillDraft(value: Partial<CustomerProfile>, source: string) {
    revision++;
    draft = value;
    newDraft = true;
    const update = document.querySelector<HTMLButtonElement>('#profile-form button[value="update"]'); if (update) update.disabled = true;
    for (const [key] of fields) {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#profile-${key}`);
      if (input) input.value = key === "suppliers" ? (value.suppliers ?? []).join("\n") : String(value[key] ?? "");
    }
    const src = document.querySelector<HTMLInputElement>("#profile-source"); if (src && !src.value) src.value = source;
    const status = document.querySelector("#profile-status"); if (status) status.textContent = "Draft prepared. Review company name, suppliers and all facts before saving; extraction may miss fields.";
  }
  async function readProfileFile(file: File, requestRevision: number) {
    if (file.size > 8_000_000) throw new Error("The profile limit is 8 MB. Use a smaller file or paste the profile text.");
    if (/\.json$/i.test(file.name)) {
      const value = JSON.parse(await file.text());
      if (revision === requestRevision) fillDraft(normalizeCustomerProfile(value.profile ?? value, "draft"), file.name);
      return;
    }
    let text = "";
    if (/\.pdf$/i.test(file.name)) {
      const moduleUrl = new URL("assets/pdfjs/pdf.mjs", document.baseURI).href;
      const pdfjs = await import(moduleUrl) as typeof import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("assets/pdfjs/pdf.worker.mjs", document.baseURI).href;
      const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: new URL("assets/pdfjs/cmaps/", document.baseURI).href, cMapPacked: true,
        standardFontDataUrl: new URL("assets/pdfjs/standard_fonts/", document.baseURI).href });
      try {
        const pdf = await loading.promise;
        if (pdf.numPages > 40) throw new Error("Use a profile of up to 40 pages, or paste the relevant text.");
        for (let i = 1; i <= pdf.numPages; i++) {
          const content = await (await pdf.getPage(i)).getTextContent();
          text += content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("") + "\n";
          if (text.length > 60000) break;
        }
      } finally { await loading.destroy(); }
    } else if (/\.txt$/i.test(file.name)) text = await file.text();
    else throw new Error("Choose a PDF, UTF-8 text file or saved profile JSON.");
    if (text.trim().length < 10) throw new Error("No readable profile text found. Scanned PDFs need OCR text; paste it or enter the company fields manually.");
    if (revision !== requestRevision) return;
    const input = document.querySelector<HTMLTextAreaElement>("#profile-text"); if (input) input.value = text.slice(0, 60000);
    fillDraft(profileDraftFromText(text), file.name);
  }
  function bind() {
    const picker = document.querySelector<HTMLSelectElement>("#customer-picker");
    if (picker) picker.onchange = () => { store.select(picker.value); draft = null; newDraft = false; checkResult = ""; activate(); };
    const newButton = document.querySelector<HTMLButtonElement>("#profile-new"); if (newButton) newButton.onclick = () => fillDraft({}, "");
    const reset = document.querySelector<HTMLButtonElement>("#profile-sadaf"); if (reset) reset.onclick = () => { store.select("sadaf"); draft = null; newDraft = false; checkResult = ""; activate(); };
    const exportButton = document.querySelector<HTMLButtonElement>("#profile-export"); if (exportButton) exportButton.onclick = () => download("customer-demo-profile.json", JSON.stringify({ version: 1, profile: profile() }, null, 2), "application/json");
    const form = document.querySelector<HTMLFormElement>("#profile-form");
    if (form) form.onsubmit = (event) => {
      event.preventDefault();
      try {
        const data = new FormData(form);
        const value = Object.fromEntries(fields.map(([key]) => [key, data.get(key)]));
        const mode = (event as SubmitEvent).submitter?.getAttribute("value");
        store.save(value, mode === "update" && !newDraft ? profile().id : undefined); draft = null; newDraft = false; checkResult = "";
        profileStatus = "Profile saved. Figures remain synthetic. Export the profile to reuse it on another computer."; activate();
        hooks.toast(store.persistent() ? "Customer presentation updated" : "Updated for this session. Export the profile to keep it.");
      } catch (error) { const status = document.querySelector("#profile-status"); if (status) status.textContent = error instanceof Error ? error.message : String(error); }
    };
    const fileInput = document.querySelector<HTMLInputElement>("#profile-file");
    if (fileInput) fileInput.onchange = async () => {
      const file = fileInput.files?.[0]; if (!file) return;
      const status = document.querySelector("#profile-status"); if (status) status.textContent = "Reading locally…";
      try { await readProfileFile(file, ++revision); } catch (error) { if (status) status.textContent = error instanceof Error ? error.message : String(error); }
    };
    const extract = document.querySelector<HTMLButtonElement>("#profile-extract");
    if (extract) extract.onclick = () => fillDraft(profileDraftFromText(document.querySelector<HTMLTextAreaElement>("#profile-text")?.value ?? ""), "Presenter-pasted profile text");
    const kind = document.querySelector<HTMLSelectElement>("#app-import-kind"); if (kind) kind.onchange = () => { checkKind = kind.value as ImportKind; checkResult = ""; hooks.render(); };
    const template = document.querySelector<HTMLButtonElement>("#app-template"); if (template) template.onclick = () => download(`MedSupply360_${checkKind}_sample.csv`, currentAppTemplate(checkKind), "text/csv;charset=utf-8");
    const templateCheck = document.querySelector<HTMLButtonElement>("#app-template-check"); if (templateCheck) templateCheck.onclick = () => showCheck(currentAppTemplate(checkKind));
    const csv = document.querySelector<HTMLInputElement>("#app-import-file");
    if (csv) csv.onchange = async () => {
      const file = csv.files?.[0]; if (!file) return;
      if (file.size > 4_500_000) { hooks.toast("CSV limit is 4.5 MB. Export a smaller period."); return; }
      try { showCheck(await file.text()); } catch { hooks.toast("The CSV could not be read."); }
    };
    const good = document.querySelector<HTMLButtonElement>("#snapshot-good"); if (good) good.onclick = () => showCheck(SNAPSHOT_SAMPLE.replace(",10,5", ",20,5"), "stock_snapshot", true);
    const bad = document.querySelector<HTMLButtonElement>("#snapshot-bad"); if (bad) bad.onclick = () => showCheck(SNAPSHOT_BAD_SAMPLE, "stock_snapshot", true);
  }
  return { profile, companyPanel, productPanel, readinessPanel, importPanel, bind, activate,
    exportProfile() { download("customer-demo-profile.json", JSON.stringify({ version: 1, profile: profile() }, null, 2), "application/json"); },
    saveActions(actions: Action[]) { const id = profile().id; sessionActions.set(id, actions); try { storage?.setItem(demoActionKey(id), JSON.stringify(actions)); } catch { hooks.toast("Actions last for this session; browser storage is unavailable."); } },
  };
}
