/**
 * Starter files for the channels that people fill by hand. A template is the importer's own headings plus one clearly
 * made-up example row, so a file filled from it is always recognised. Pure.
 */
import { SPECS, type ImportKind } from "./specs";

/** The heading a person sees for a field: its first accepted spelling, capitalised ("Tender no", "Product line"). */
export function headingOf(kind: ImportKind, key: string): string {
  const field = SPECS[kind].fields.find((f) => f.key === key);
  const word = field?.aliases[0] ?? key;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** One made-up row per hand-filled type. Never real names or figures. */
const EXAMPLE: Partial<Record<ImportKind, Record<string, string>>> = {
  tenders: {
    authority: "MOH",
    tenderNo: "EXAMPLE-2026-01",
    title: "Example analyzer supply tender",
    productLine: "equipment",
    status: "open",
    estimatedValue: "50000",
    deadline: "2026-12-01",
  },
  sales_people: {
    name: "Example Sales Person",
    email: "sales.person@example.com",
    suppliers: "Example Supplier A; Example Supplier B",
    monthlySalesTarget: "20000",
    newAccountsTarget: "2",
    visitsPerWeek: "10",
    active: "Yes",
  },
  installed_units: {
    code: "EXAMPLE-U1",
    customerCode: "EXAMPLE-C1",
    productCode: "EXAMPLE-P1",
    name: "Example analyzer",
    installedOn: "2025-01-15",
    warrantyEnd: "2027-01-14",
    service: "Active",
    expectedMonthlyConsumables: "400",
  },
};

export const hasTemplate = (kind: ImportKind): boolean => kind in EXAMPLE;

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV text (with a BOM so Excel reads Arabic correctly) for one type: headings, then the example row. */
export function templateCsv(kind: ImportKind): string {
  const keys = SPECS[kind].fields.map((f) => f.key);
  const example = EXAMPLE[kind] ?? {};
  const rows = [keys.map((k) => headingOf(kind, k)), keys.map((k) => example[k] ?? "")];
  return "﻿" + rows.map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";
}
