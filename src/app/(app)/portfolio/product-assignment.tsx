import Link from "next/link";
import { canManageSalesForce, type Role } from "@/core/permissions";
import { getDb } from "@/db/client";
import { listProductsForAssignment, listSalesPeople, type ProductAssignRow } from "@/server/services/sales-force";
import { ProductAssign, SupplierAssign } from "./assign-controls";

const NO_SUPPLIER = "No supplier recorded";

/**
 * The company's products grouped by supplier, each with the sales person who holds it. The CEO scrolls down the list and
 * picks a person per product, or gives a whole supplier to one person. Everyone else with access sees who holds what.
 */
export async function ProductAssignment({ companyId, role }: { companyId: string; role: Role }) {
  const db = getDb();
  const [rows, people] = await Promise.all([listProductsForAssignment(db, companyId), listSalesPeople(db, companyId)]);
  const manage = canManageSalesForce(role);
  if (rows.length === 0) return null;

  const groups = new Map<string, ProductAssignRow[]>();
  for (const r of rows) {
    const key = r.supplierName?.trim() || NO_SUPPLIER;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const choices = people.map((p) => ({ id: p.id, name: p.name, active: p.active }));

  return (
    <section id="assign-products" aria-label="Assign products to the sales force" className="mt-8 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Products and who sells them</h2>
        <p className="mt-1 text-xs text-muted">
          {manage
            ? "Choose a sales person for each product, or give all the products of a supplier to one person. What you set here also shows on the Sales force page."
            : "Which sales person holds each product. The owner sets this."}
        </p>
        {manage && people.length === 0 ? (
          <p className="mt-2 rounded-lg border border-line bg-white p-3 text-xs">
            Your sales force is empty.{" "}
            <Link href="/sales-force" className="underline underline-offset-2">
              Add your sales people first
            </Link>
            , then come back to assign products.
          </p>
        ) : null}
      </div>
      {[...groups.entries()].map(([supplier, items]) => {
        const assigned = items.filter((i) => i.salesPersonId).length;
        return (
          <details key={supplier} className="rounded-lg border border-line bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              {supplier}
              <span className="ml-2 text-xs font-normal text-muted">
                {items.length} product{items.length === 1 ? "" : "s"} · {assigned} assigned
              </span>
            </summary>
            <div className="border-t border-line px-4 py-3">
              {manage && supplier !== NO_SUPPLIER && people.length > 0 ? <SupplierAssign supplierName={supplier} people={choices} /> : null}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Product</th>
                      <th className="py-1.5 pr-3 font-medium">Line</th>
                      <th className="py-1.5 pr-3 font-medium">Area</th>
                      <th className="py-1.5 font-medium">Sales person</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} className="border-t border-line align-middle">
                        <td className="py-1.5 pr-3">
                          {p.name}
                          <span className="block text-xs text-muted">{p.code}</span>
                        </td>
                        <td className="py-1.5 pr-3 text-xs">{p.line}</td>
                        <td className="py-1.5 pr-3 text-xs">{p.therapeuticArea ?? "—"}</td>
                        <td className="py-1.5">
                          {manage ? (
                            <ProductAssign productId={p.id} currentId={p.salesPersonId} people={choices} />
                          ) : p.salesPersonName ? (
                            <span className="text-xs">{p.salesPersonName}</span>
                          ) : (
                            <span className="text-xs text-muted">Not assigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        );
      })}
    </section>
  );
}
