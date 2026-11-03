import { describe, expect, it } from "vitest";
import { MAINTENANCE_UPLOAD_KINDS, TENDER_UPLOAD_KINDS, canImportKind, canUploadEquipment, canUploadTenders, ASSIGNABLE_ROLES, ROLES, canAccess, canManageSalesForce, canManageSupport, canEditProfile, canManageActions, canSeeHistory, canSeeSalesForce, canEditGuarantees, canEditPayments, canEditTender, canMoveTender, homePath, isAssignableRole } from "./permissions";

describe("permissions", () => {
  it("lets the owner open everything", () => {
    for (const area of ["business", "tender", "settings"] as const) expect(canAccess("owner", area)).toBe(true);
  });

  it("keeps department roles inside the tender section", () => {
    for (const role of ["tender", "finance"] as const) {
      expect(canAccess(role, "tender")).toBe(true);
      expect(canAccess(role, "business")).toBe(false);
      expect(canAccess(role, "settings")).toBe(false);
    }
  });

  it("keeps the tender section away from viewers and Settings away from everyone but the owner", () => {
    expect(canAccess("viewer", "tender")).toBe(false);
    for (const role of ROLES.filter((r) => r !== "owner")) expect(canAccess(role, "settings")).toBe(false);
  });

  it("lets only the owner manage the sales force and only the owner and administrators read it", () => {
    expect(ROLES.filter(canManageSalesForce)).toEqual(["owner"]);
    expect(ROLES.filter(canSeeSalesForce)).toEqual(["owner", "admin"]);
  });

  it("lets only the owner define support indicators and record readings", () => {
    expect(ROLES.filter(canManageSupport)).toEqual(["owner"]);
  });

  it("lets the owner and administrators manage management actions", () => {
    expect(ROLES.filter(canManageActions)).toEqual(["owner", "admin"]);
  });

  it("lets only the owner write the company profile", () => {
    expect(ROLES.filter(canEditProfile)).toEqual(["owner"]);
  });

  it("shows the update history to the owner and administrators only", () => {
    expect(ROLES.filter(canSeeHistory)).toEqual(["owner", "admin"]);
  });

  it("sends each role to a page it may open", () => {
    expect(homePath("owner")).toBe("/dashboard");
    expect(homePath("viewer")).toBe("/dashboard");
    expect(homePath("tender")).toBe("/tenders");
    expect(homePath("finance")).toBe("/tenders");
  });

  it("never lets Settings hand out the owner role", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole("tender")).toBe(true);
    expect(isAssignableRole("root")).toBe(false);
  });
});

describe("tender permissions", () => {
  it("lets the tender department and the owner edit, and nobody else", () => {
    expect(canEditTender("owner")).toBe(true);
    expect(canEditTender("tender")).toBe(true);
    for (const role of ["admin", "viewer", "finance"] as const) expect(canEditTender(role)).toBe(false);
  });

  it("hands payment collection to finance and keeps it away from the tender department", () => {
    expect(canMoveTender("tender", "preparing", "submitted")).toBe(true);
    expect(canMoveTender("tender", "delivered", "collected")).toBe(false);
    expect(canMoveTender("finance", "delivered", "collected")).toBe(true);
    expect(canMoveTender("finance", "collected", "delivered")).toBe(true);
    expect(canMoveTender("finance", "preparing", "submitted")).toBe(false);
    expect(canMoveTender("owner", "delivered", "collected")).toBe(true);
    expect(canMoveTender("admin", "preparing", "submitted")).toBe(false);
    expect(canMoveTender("viewer", "delivered", "collected")).toBe(false);
  });
});

describe("tender money permissions", () => {
  it("lets the tender department, finance and the owner edit guarantees, but only finance and the owner edit payments", () => {
    for (const role of ["owner", "tender", "finance"] as const) expect(canEditGuarantees(role)).toBe(true);
    for (const role of ["admin", "viewer"] as const) expect(canEditGuarantees(role)).toBe(false);
    expect(canEditPayments("owner")).toBe(true);
    expect(canEditPayments("finance")).toBe(true);
    for (const role of ["tender", "admin", "viewer"] as const) expect(canEditPayments(role)).toBe(false);
  });
});

describe("who may upload which file", () => {
  it("lets the owner upload anything", () => {
    for (const kind of ["sales", "open_invoices", "tenders", "tender_results", "installed_units", "sales_people"] as const) expect(canImportKind("owner", kind)).toBe(true);
  });

  it("lets the tender department upload the tender list and tender results only", () => {
    expect([...TENDER_UPLOAD_KINDS]).toEqual(["tenders", "tender_results"]);
    for (const kind of TENDER_UPLOAD_KINDS) expect(canImportKind("tender", kind)).toBe(true);
    for (const kind of ["products", "customers", "sales", "receipts", "open_invoices", "stock_snapshot", "stock_transactions", "installed_units", "sales_people"] as const) {
      expect(canImportKind("tender", kind), kind).toBe(false);
    }
  });

  it("keeps everyone else from uploading", () => {
    for (const role of ["admin", "viewer", "finance"] as const) {
      expect(canImportKind(role, "tenders")).toBe(false);
      expect(canUploadTenders(role)).toBe(false);
    }
    expect(canUploadTenders("owner")).toBe(true);
    expect(canUploadTenders("tender")).toBe(true);
  });
});

describe("the maintenance department", () => {
  it("opens the machine screens only, never business or tender screens, and lands on the installed base", () => {
    expect(canAccess("maintenance", "service")).toBe(true);
    for (const area of ["business", "tender", "settings"] as const) expect(canAccess("maintenance", area)).toBe(false);
    expect(homePath("maintenance")).toBe("/installed-base");
    expect(homePath("tender")).toBe("/tenders");
    expect(homePath("viewer")).toBe("/dashboard");
  });

  it("uploads the equipment file only", () => {
    expect([...MAINTENANCE_UPLOAD_KINDS]).toEqual(["installed_units"]);
    expect(canImportKind("maintenance", "installed_units")).toBe(true);
    for (const kind of ["sales", "open_invoices", "tenders", "tender_results", "sales_people", "products"] as const) expect(canImportKind("maintenance", kind), kind).toBe(false);
    expect(canUploadEquipment("maintenance")).toBe(true);
    expect(canUploadEquipment("owner")).toBe(true);
    for (const role of ["admin", "viewer", "tender", "finance"] as const) expect(canUploadEquipment(role)).toBe(false);
    expect(canImportKind("tender", "installed_units")).toBe(false);
  });

  it("keeps the business roles able to open the machine screens", () => {
    for (const role of ["owner", "admin", "viewer"] as const) expect(canAccess(role, "service")).toBe(true);
    for (const role of ["tender", "finance"] as const) expect(canAccess(role, "service")).toBe(false);
  });
});
