/**
 * SYNTHETIC tender demonstration data. Not real tenders, prices or guarantees. It uses the real authority codes so the
 * screens look like the live ones, but every title, number and amount is made up. The same records feed the in-app sample
 * (/sample/tenders) and the promotional demo, and all figures are derived through the tested tender rules.
 */
import { buildTenderOverview, type OverviewGuarantee, type OverviewInvoice, type OverviewTender, type TenderOverview } from "@/core/tender-overview";
import { guaranteeState, paymentSummary, type GuaranteeKind } from "@/core/tender-money";
import { daysInStage, type TenderLine } from "@/core/tender-flow";
import { DEMO_AS_OF } from "./dataset";

export interface DemoTender extends OverviewTender {
  tenderNo: string | null;
  productLine: TenderLine;
  contractNo: string | null;
  deliveredOn: string | null;
  history: { to: OverviewTender["status"]; on: string; by: string; note?: string }[];
}

export interface DemoGuarantee extends OverviewGuarantee {
  kind: GuaranteeKind;
  issuedOn: string | null;
  reference: string;
}

export interface DemoInvoice extends OverviewInvoice {
  invoiceNo: string;
  invoiceDate: string;
  lastCollectedOn: string | null;
}

const base = { estimatedValue: null, bidValue: null, awardAmount: null, contractValue: null, deadline: null, closeReason: null, tenderNo: null, contractNo: null, deliveredOn: null } as const;

export const DEMO_TENDERS: DemoTender[] = [
  { ...base, id: "d1", authority: "MOH", title: "Haemodialysis consumables, 12-month supply", productLine: "consumables", status: "preparing", statusChangedAt: "2026-09-29T08:00:00Z", tenderNo: "MOH-26-118", estimatedValue: 420000, deadline: "2026-10-22", history: [{ to: "pipeline", on: "2026-08-20", by: "Tender team" }, { to: "open", on: "2026-09-15", by: "Tender team" }, { to: "preparing", on: "2026-09-29", by: "Tender team", note: "Samples requested by the authority" }] },
  { ...base, id: "d2", authority: "KHCC", title: "Infusion pumps for oncology wards", productLine: "equipment", status: "open", statusChangedAt: "2026-10-05T08:00:00Z", tenderNo: "KHCC-26-031", estimatedValue: 275000, deadline: "2026-10-30", history: [{ to: "pipeline", on: "2026-09-02", by: "Tender team" }, { to: "open", on: "2026-10-05", by: "Tender team" }] },
  { ...base, id: "d3", authority: "JUH", title: "ICU patient monitors", productLine: "equipment", status: "submitted", statusChangedAt: "2026-09-21T08:00:00Z", tenderNo: "JUH-26-009", estimatedValue: 330000, bidValue: 310000, deadline: "2026-09-20", history: [{ to: "pipeline", on: "2026-07-30", by: "Tender team" }, { to: "open", on: "2026-08-12", by: "Tender team" }, { to: "preparing", on: "2026-08-25", by: "Tender team" }, { to: "submitted", on: "2026-09-21", by: "Tender team" }] },
  { ...base, id: "d4", authority: "KAUH", title: "Surgical electrosurgery units", productLine: "equipment", status: "technical_review", statusChangedAt: "2026-09-10T08:00:00Z", tenderNo: "KAUH-26-077", estimatedValue: 180000, bidValue: 165000, deadline: "2026-08-30", history: [{ to: "pipeline", on: "2026-07-01", by: "Tender team" }, { to: "open", on: "2026-07-20", by: "Tender team" }, { to: "preparing", on: "2026-08-02", by: "Tender team" }, { to: "submitted", on: "2026-08-29", by: "Tender team" }, { to: "technical_review", on: "2026-09-10", by: "Tender team", note: "Demonstration requested" }] },
  { ...base, id: "d5", authority: "DRMS", title: "Laboratory reagents, annual framework", productLine: "consumables", status: "financial_review", statusChangedAt: "2026-09-25T08:00:00Z", tenderNo: "DRMS-26-204", estimatedValue: 540000, bidValue: 520000, deadline: "2026-08-15", history: [{ to: "pipeline", on: "2026-06-18", by: "Tender team" }, { to: "open", on: "2026-07-05", by: "Tender team" }, { to: "preparing", on: "2026-07-14", by: "Tender team" }, { to: "submitted", on: "2026-08-14", by: "Tender team" }, { to: "technical_review", on: "2026-08-28", by: "Tender team" }, { to: "financial_review", on: "2026-09-25", by: "Tender team" }] },
  { ...base, id: "d6", authority: "MOH", title: "Ventilator circuits framework", productLine: "consumables", status: "won", statusChangedAt: "2026-10-01T08:00:00Z", tenderNo: "MOH-26-066", estimatedValue: 400000, bidValue: 395000, awardAmount: 380000, deadline: "2026-07-25", history: [{ to: "pipeline", on: "2026-05-30", by: "Tender team" }, { to: "open", on: "2026-06-10", by: "Tender team" }, { to: "preparing", on: "2026-06-22", by: "Tender team" }, { to: "submitted", on: "2026-07-24", by: "Tender team" }, { to: "technical_review", on: "2026-08-08", by: "Tender team" }, { to: "financial_review", on: "2026-09-02", by: "Tender team" }, { to: "won", on: "2026-10-01", by: "Tender team", note: "Awarded at JOD 380,000" }] },
  { ...base, id: "d7", authority: "KHCC", title: "Syringe pumps", productLine: "equipment", status: "contracted", statusChangedAt: "2026-09-18T08:00:00Z", tenderNo: "KHCC-26-012", estimatedValue: 150000, bidValue: 145000, awardAmount: 142000, contractValue: 142000, contractNo: "PO-KHCC-5521", deadline: "2026-06-30", history: [{ to: "pipeline", on: "2026-04-22", by: "Tender team" }, { to: "open", on: "2026-05-12", by: "Tender team" }, { to: "preparing", on: "2026-05-28", by: "Tender team" }, { to: "submitted", on: "2026-06-29", by: "Tender team" }, { to: "technical_review", on: "2026-07-10", by: "Tender team" }, { to: "financial_review", on: "2026-07-30", by: "Tender team" }, { to: "won", on: "2026-08-20", by: "Tender team" }, { to: "contracted", on: "2026-09-18", by: "Tender team", note: "Purchase order received" }] },
  { ...base, id: "d8", authority: "JUH", title: "Dialysis machines", productLine: "equipment", status: "delivered", statusChangedAt: "2026-09-12T08:00:00Z", tenderNo: "JUH-25-140", estimatedValue: 640000, bidValue: 615000, awardAmount: 610000, contractValue: 610000, contractNo: "PO-JUH-8830", deliveredOn: "2026-09-12", deadline: "2026-03-10", history: [{ to: "pipeline", on: "2026-01-15", by: "Tender team" }, { to: "open", on: "2026-02-02", by: "Tender team" }, { to: "preparing", on: "2026-02-12", by: "Tender team" }, { to: "submitted", on: "2026-03-09", by: "Tender team" }, { to: "technical_review", on: "2026-03-25", by: "Tender team" }, { to: "financial_review", on: "2026-04-20", by: "Tender team" }, { to: "won", on: "2026-05-15", by: "Tender team" }, { to: "contracted", on: "2026-06-05", by: "Tender team" }, { to: "delivered", on: "2026-09-12", by: "Tender team", note: "Installed and accepted" }] },
  { ...base, id: "d9", authority: "DRMS", title: "Glucose test strips", productLine: "consumables", status: "collected", statusChangedAt: "2026-09-30T08:00:00Z", tenderNo: "DRMS-26-031", estimatedValue: 90000, bidValue: 88000, awardAmount: 88000, contractValue: 88000, contractNo: "PO-DRMS-1904", deliveredOn: "2026-08-14", deadline: "2026-03-01", history: [{ to: "pipeline", on: "2026-01-10", by: "Tender team" }, { to: "open", on: "2026-01-25", by: "Tender team" }, { to: "preparing", on: "2026-02-05", by: "Tender team" }, { to: "submitted", on: "2026-02-28", by: "Tender team" }, { to: "technical_review", on: "2026-03-12", by: "Tender team" }, { to: "financial_review", on: "2026-03-30", by: "Tender team" }, { to: "won", on: "2026-04-18", by: "Tender team" }, { to: "contracted", on: "2026-05-05", by: "Tender team" }, { to: "delivered", on: "2026-08-14", by: "Tender team" }, { to: "collected", on: "2026-09-30", by: "Finance", note: "Paid in full" }] },
  { ...base, id: "d10", authority: "KAUH", title: "Anaesthesia workstations", productLine: "equipment", status: "lost", statusChangedAt: "2026-09-05T08:00:00Z", tenderNo: "KAUH-26-040", estimatedValue: 470000, bidValue: 450000, deadline: "2026-07-15", closeReason: "Our price was 9% above the winning bid", history: [{ to: "pipeline", on: "2026-05-02", by: "Tender team" }, { to: "open", on: "2026-05-20", by: "Tender team" }, { to: "preparing", on: "2026-06-01", by: "Tender team" }, { to: "submitted", on: "2026-07-14", by: "Tender team" }, { to: "technical_review", on: "2026-07-30", by: "Tender team" }, { to: "financial_review", on: "2026-08-15", by: "Tender team" }, { to: "lost", on: "2026-09-05", by: "Tender team", note: "Our price was 9% above the winning bid" }] },
  { ...base, id: "d11", authority: "MOH", title: "Steam sterilizers", productLine: "equipment", status: "cancelled", statusChangedAt: "2026-08-28T08:00:00Z", tenderNo: "MOH-26-044", estimatedValue: 220000, deadline: "2026-08-10", closeReason: "The authority withdrew the tender", history: [{ to: "pipeline", on: "2026-06-01", by: "Tender team" }, { to: "open", on: "2026-06-18", by: "Tender team" }, { to: "cancelled", on: "2026-08-28", by: "Tender team", note: "The authority withdrew the tender" }] },
  { ...base, id: "d12", authority: "JUH", title: "Blood gas analyzers", productLine: "equipment", status: "pipeline", statusChangedAt: "2026-10-02T08:00:00Z", estimatedValue: 190000, history: [{ to: "pipeline", on: "2026-10-02", by: "Tender team", note: "Hospital plans to buy next quarter" }] },
  { ...base, id: "d13", authority: "MOH", title: "Pulse oximeters", productLine: "equipment", status: "preparing", statusChangedAt: "2026-09-12T08:00:00Z", tenderNo: "MOH-26-131", estimatedValue: 60000, deadline: "2026-10-03", history: [{ to: "pipeline", on: "2026-08-25", by: "Tender team" }, { to: "open", on: "2026-09-02", by: "Tender team" }, { to: "preparing", on: "2026-09-12", by: "Tender team" }] },
];

export const DEMO_GUARANTEES: DemoGuarantee[] = [
  { tenderId: "d1", kind: "bid", amount: 21000, issuedOn: "2026-10-02", expiresOn: "2027-01-20", returnedOn: null, reference: "BG-0098" },
  { tenderId: "d3", kind: "bid", amount: 15500, issuedOn: "2026-09-18", expiresOn: "2026-12-31", returnedOn: null, reference: "BG-0091" },
  { tenderId: "d4", kind: "bid", amount: 8250, issuedOn: "2026-08-25", expiresOn: "2026-11-27", returnedOn: null, reference: "BG-0084" },
  { tenderId: "d5", kind: "bid", amount: 26000, issuedOn: "2026-08-10", expiresOn: "2026-11-12", returnedOn: null, reference: "BG-0079" },
  { tenderId: "d10", kind: "bid", amount: 22500, issuedOn: "2026-07-10", expiresOn: "2026-09-30", returnedOn: null, reference: "BG-0066" },
  { tenderId: "d7", kind: "performance", amount: 14200, issuedOn: "2026-09-20", expiresOn: "2027-09-20", returnedOn: null, reference: "PG-0021" },
  { tenderId: "d8", kind: "performance", amount: 61000, issuedOn: "2026-06-10", expiresOn: "2027-09-10", returnedOn: null, reference: "PG-0017" },
  { tenderId: "d9", kind: "performance", amount: 8800, issuedOn: "2026-05-10", expiresOn: "2026-10-30", returnedOn: "2026-10-02", reference: "PG-0009" },
];

export const DEMO_INVOICES: DemoInvoice[] = [
  { tenderId: "d8", invoiceNo: "INV-2026-0412", invoiceDate: "2026-09-14", amount: 400000, collected: 250000, lastCollectedOn: "2026-10-02" },
  { tenderId: "d8", invoiceNo: "INV-2026-0433", invoiceDate: "2026-09-28", amount: 210000, collected: 0, lastCollectedOn: null },
  { tenderId: "d9", invoiceNo: "INV-2026-0301", invoiceDate: "2026-08-16", amount: 88000, collected: 88000, lastCollectedOn: "2026-09-30" },
];

export const DEMO_TENDER_AS_OF = DEMO_AS_OF;

export function demoTenderOverview(): TenderOverview {
  return buildTenderOverview({ today: DEMO_TENDER_AS_OF, tenders: DEMO_TENDERS, guarantees: DEMO_GUARANTEES, invoices: DEMO_INVOICES });
}

/** A tender with the figures its detail view shows, derived with the same rules as the live screens. */
export function demoTenderDetail(id: string) {
  const tender = DEMO_TENDERS.find((t) => t.id === id);
  if (!tender) return null;
  const guarantees = DEMO_GUARANTEES.filter((g) => g.tenderId === id).map((g) => ({ ...g, state: guaranteeState(g, DEMO_TENDER_AS_OF) }));
  const invoices = DEMO_INVOICES.filter((i) => i.tenderId === id);
  return { tender, guarantees, invoices, payments: paymentSummary(invoices), daysInStage: daysInStage(tender.statusChangedAt, DEMO_TENDER_AS_OF) };
}
