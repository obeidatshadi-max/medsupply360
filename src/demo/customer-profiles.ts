/** Presentation context only. A profile does not supply financial or operational records. */
export interface CustomerProfile {
  id: string;
  name: string;
  location: string;
  founded: string;
  team: string;
  audience: string;
  purpose: string;
  address: string;
  erp: string;
  source: string;
  suppliers: string[];
  notes: string;
}

export const SADAF_PROFILE: CustomerProfile = {
  id: "sadaf", name: "Sadaf Medical Supplies", location: "Jordan", founded: "2008", team: "Approximately 20 in 2022",
  audience: "Governmental and private hospitals, universities, and healthcare facilities.",
  purpose: "Promoting and distributing medical brands, with an emphasis on clinical benefit, products, and customer support.",
  address: "67 Amer Bin Malek street, Khalda, Amman, Jordan 11953", erp: "Alpha ERP",
  source: "Supplied Sadaf company profile, 2022", suppliers: [], notes: "Historical company context; current staffing and supplier relationships require confirmation.",
};

const text = (v: unknown, max = 1000) => typeof v === "string" ? v.trim().slice(0, max) : "";
export function normalizeCustomerProfile(value: unknown, id: string): CustomerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a company profile object.");
  const r = value as Record<string, unknown>;
  const name = text(r.name, 160);
  if (!name) throw new Error("Enter the company name before saving.");
  const suppliers = Array.isArray(r.suppliers) ? r.suppliers : typeof r.suppliers === "string" ? r.suppliers.split(/\r?\n|;/) : [];
  return { id, name, location: text(r.location, 160), founded: text(r.founded, 80), team: text(r.team, 160),
    audience: text(r.audience, 1500), purpose: text(r.purpose, 2000), address: text(r.address, 1000), erp: text(r.erp, 160),
    source: text(r.source, 500), suppliers: [...new Set(suppliers.map((s) => text(s, 160)).filter(Boolean))].slice(0, 80), notes: text(r.notes, 4000) };
}

export function profileDraftFromText(raw: string): Partial<CustomerProfile> {
  const lines = raw.slice(0, 60000).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const find = (label: string) => lines.map((s) => s.match(new RegExp(`^(?:${label})\\s*[:：]\\s*(.+)$`, "i"))?.[1]).find(Boolean) ?? "";
  return { name: find("company(?: name)?|name|اسم الشركة") || lines.find((s) => s.length >= 3 && s.length < 160) || "",
    location: find("location|country|الموقع"), address: find("address|العنوان"),
    founded: find("founded|established|تأسست") || raw.match(/(?:established|founded|since)\s*(?:in\s*)?((?:19|20)\d{2})/i)?.[1] || "",
    team: find("team|employees|headcount"), erp: find("erp|accounting system"),
    audience: find("customers|audience|serves"), purpose: find("purpose|about|description"),
    suppliers: (find("suppliers|brands|partners|principals") || "").split(/;|,/).map((s) => s.trim()).filter(Boolean),
  };
}

export interface DemoStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const KEY = "medsupply360.customerProfiles.v1";
export function customerProfileStore(storage?: DemoStorage) {
  let profiles: CustomerProfile[] = [{ ...SADAF_PROFILE, suppliers: [] }];
  let activeId = "sadaf";
  let persistent = !!storage;
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || "null");
    if (saved?.version === 1 && Array.isArray(saved.profiles)) {
      profiles.push(...saved.profiles.slice(0, 30).flatMap((p: unknown) => {
        try {
          const id = (p as Record<string, unknown>)?.id;
          return typeof id === "string" && /^customer-[a-z0-9-]+$/.test(id) ? [normalizeCustomerProfile(p, id)] : [];
        } catch { return []; }
      }));
      activeId = profiles.some((p) => p.id === saved.activeId) ? saved.activeId : "sadaf";
    }
  } catch { persistent = false; }
  function persist() {
    try {
      if (!storage) throw new Error("Browser storage unavailable");
      storage.setItem(KEY, JSON.stringify({ version: 1, profiles: profiles.filter((p) => p.id !== "sadaf"), activeId }));
    } catch { persistent = false; }
  }
  return {
    list: () => profiles.map((p) => ({ ...p, suppliers: [...p.suppliers] })),
    active: () => ({ ...profiles.find((p) => p.id === activeId)!, suppliers: [...profiles.find((p) => p.id === activeId)!.suppliers] }),
    persistent: () => persistent,
    select(id: string) { if (!profiles.some((p) => p.id === id)) throw new Error("Company profile not found."); activeId = id; persist(); return this.active(); },
    save(value: unknown, existingId?: string) {
      if ((!existingId || existingId === "sadaf") && profiles.length >= 31) throw new Error("This browser has 30 saved customers. Update an existing customer, or export profiles before using a fresh browser workspace.");
      const id = existingId && profiles.some((p) => p.id === existingId) && existingId !== "sadaf" ? existingId : `customer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      const p = normalizeCustomerProfile(value, id);
      profiles = profiles.filter((r) => r.id !== id); profiles.push(p); activeId = id; persist(); return p;
    },
  };
}

export const demoActionKey = (id: string) => id === "sadaf" ? "sadaf360Actions" : `medsupply360.demo.${id}.actions`;
