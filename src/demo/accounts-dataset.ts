/**
 * SYNTHETIC account-level data: tender (public-sector) accounts versus private accounts.
 * Eight accounts add up exactly to the business-line totals in ./dataset, and a test enforces it.
 * Not real company data.
 */
import type { LineName } from "./dataset";

export type Segment = "Tender" | "Private";

export interface AccountSeed {
  id: string;
  /** Unique; invoices, installed units and tenders in ./dataset refer to accounts by this name. */
  name: string;
  /** Tender = public-sector body that buys through formal tenders. Private = private hospital, centre or clinic buying by quotation or PO. */
  segment: Segment;
  type: string;
  city: string;
  manager: string;
  /** Agreed payment terms, days. */
  termsDays: number;
  /** Approved credit limit (JOD). */
  creditLimit: number;
  /** YTD sales target (JOD). */
  target: number;
  /** Same period last year (JOD). */
  priorSales: number;
  priorGrossProfit: number;
  /** Cash received YTD (JOD). Opening receivables are assumed nil in this synthetic data. */
  collected: number;
  /** Unpaid at the snapshot date (JOD), overdue or not. */
  outstanding: number;
  lastOrder: string;
  ordersYtd: number;
  /** YTD figures by business line (JOD). Gross profit = net sales less product cost. */
  byLine: Record<LineName, { sales: number; grossProfit: number; directCosts: number }>;
}

export const accounts: AccountSeed[] = [
  {
    id: "T-01", name: "Jordan Valley Public Hospitals Group", segment: "Tender", type: "Public hospital group", city: "Amman", manager: "Tender manager",
    termsDays: 120, creditLimit: 250000, target: 750000, priorSales: 684128, priorGrossProfit: 207745,
    collected: 570691, outstanding: 200147, lastOrder: "2026-09-30", ordersYtd: 24,
    byLine: {
      Equipment: { sales: 154513, grossProfit: 34170, directCosts: 6286 },
      Devices: { sales: 60718, grossProfit: 17716, directCosts: 2048 },
      Consumables: { sales: 555607, grossProfit: 194918, directCosts: 13385 },
    },
  },
  {
    id: "T-02", name: "Jabal Amman University Hospital", segment: "Tender", type: "University hospital", city: "Amman", manager: "Tender manager",
    termsDays: 90, creditLimit: 200000, target: 800000, priorSales: 809792, priorGrossProfit: 223342,
    collected: 599827, outstanding: 146404, lastOrder: "2026-08-20", ordersYtd: 9,
    byLine: {
      Equipment: { sales: 418926, grossProfit: 93673, directCosts: 23461 },
      Devices: { sales: 139883, grossProfit: 41493, directCosts: 6777 },
      Consumables: { sales: 187422, grossProfit: 66299, directCosts: 4586 },
    },
  },
  {
    id: "T-03", name: "Red Sea Specialty Hospital", segment: "Tender", type: "Government hospital", city: "Aqaba", manager: "Tender manager",
    termsDays: 90, creditLimit: 200000, target: 550000, priorSales: 513533, priorGrossProfit: 133809,
    collected: 403923, outstanding: 155782, lastOrder: "2026-09-10", ordersYtd: 6,
    byLine: {
      Equipment: { sales: 350313, grossProfit: 66963, directCosts: 28691 },
      Devices: { sales: 87967, grossProfit: 23820, directCosts: 4115 },
      Consumables: { sales: 121425, grossProfit: 42595, directCosts: 3211 },
    },
  },
  {
    id: "T-04", name: "Eastern Badia Regional Medical Center", segment: "Tender", type: "Military medical services", city: "Amman", manager: "Tender manager",
    termsDays: 90, creditLimit: 100000, target: 480000, priorSales: 409117, priorGrossProfit: 117079,
    collected: 399499, outstanding: 57999, lastOrder: "2026-07-28", ordersYtd: 4,
    byLine: {
      Equipment: { sales: 197487, grossProfit: 47593, directCosts: 11817 },
      Devices: { sales: 170322, grossProfit: 51814, directCosts: 9601 },
      Consumables: { sales: 89689, grossProfit: 33075, directCosts: 2573 },
    },
  },
  {
    id: "P-01", name: "Dabouq Heights Private Hospital", segment: "Private", type: "Private hospital", city: "Amman", manager: "Sales rep A",
    termsDays: 60, creditLimit: 80000, target: 650000, priorSales: 591751, priorGrossProfit: 215433,
    collected: 667439, outstanding: 42995, lastOrder: "2026-10-02", ordersYtd: 38,
    byLine: {
      Equipment: { sales: 151571, grossProfit: 59212, directCosts: 5757 },
      Devices: { sales: 163054, grossProfit: 58497, directCosts: 7140 },
      Consumables: { sales: 395809, grossProfit: 166864, directCosts: 9191 },
    },
  },
  {
    id: "P-02", name: "Irbid Al-Wasl Surgical Center", segment: "Private", type: "Surgical center", city: "Irbid", manager: "Sales rep B",
    termsDays: 60, creditLimit: 60000, target: 640000, priorSales: 652892, priorGrossProfit: 225999,
    collected: 588701, outstanding: 42392, lastOrder: "2026-09-29", ordersYtd: 31,
    byLine: {
      Equipment: { sales: 93606, grossProfit: 32894, directCosts: 3874 },
      Devices: { sales: 238532, grossProfit: 83730, directCosts: 12066 },
      Consumables: { sales: 298955, grossProfit: 128010, directCosts: 7514 },
    },
  },
  {
    id: "P-03", name: "Rawabi Wound and Diabetes Clinic", segment: "Private", type: "Specialist clinic", city: "Zarqa", manager: "Sales rep A",
    termsDays: 45, creditLimit: 30000, target: 300000, priorSales: 308068, priorGrossProfit: 114038,
    collected: 263469, outstanding: 21575, lastOrder: "2026-08-14", ordersYtd: 22,
    byLine: {
      Equipment: { sales: 40462, grossProfit: 15942, directCosts: 1551 },
      Devices: { sales: 48804, grossProfit: 17071, directCosts: 2735 },
      Consumables: { sales: 195778, grossProfit: 87213, directCosts: 6865 },
    },
  },
  {
    id: "P-04", name: "Khalda Garden Private Hospital", segment: "Private", type: "Private hospital", city: "Amman", manager: "Sales rep C",
    termsDays: 60, creditLimit: 25000, target: 350000, priorSales: 300182, priorGrossProfit: 108843,
    collected: 371308, outstanding: 7862, lastOrder: "2026-10-05", ordersYtd: 26,
    byLine: {
      Equipment: { sales: 41131, grossProfit: 15978, directCosts: 1997 },
      Devices: { sales: 81942, grossProfit: 27245, directCosts: 4522 },
      Consumables: { sales: 256097, grossProfit: 103258, directCosts: 8600 },
    },
  },
];

/** First and last day of the year-to-date figures (inclusive). */
export const DEMO_PERIOD_START = "2026-01-01";
export const DEMO_PERIOD_END = "2026-09-30";

export interface TenderProgress {
  /** Share of the contract delivered, percent. */
  deliveredPct: number;
  /** Invoiced so far (JOD). */
  invoiced: number;
  /** Cash received against those invoices (JOD). */
  collected: number;
  guarantee: { kind: "Bid bond" | "Performance bond"; amount: number; expires: string };
}

/** Delivery, billing and guarantee detail for the tenders listed in ./dataset. */
export const tenderProgress: Record<string, TenderProgress> = {
  "TN-041": { deliveredPct: 0, invoiced: 0, collected: 0, guarantee: { kind: "Bid bond", amount: 5497, expires: "2027-01-18" } },
  "TN-052": { deliveredPct: 0, invoiced: 0, collected: 0, guarantee: { kind: "Bid bond", amount: 3326, expires: "2026-12-24" } },
  "TN-061": { deliveredPct: 35, invoiced: 134365, collected: 91350, guarantee: { kind: "Performance bond", amount: 38390, expires: "2027-05-31" } },
  "TN-033": { deliveredPct: 100, invoiced: 187460, collected: 131176, guarantee: { kind: "Performance bond", amount: 18746, expires: "2026-12-10" } },
};

/** Tender outcomes this year (number of tenders, values in JOD). Pending = submitted, no decision yet. */
export const tenderHistory = { submitted: 14, won: 6, lost: 5, pending: 3, valueSubmitted: 3918400, valueWon: 1662300 };
