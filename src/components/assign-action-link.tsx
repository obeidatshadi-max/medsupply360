import Link from "next/link";
import { addActionHref } from "@/core/management-actions";
import { canManageActions, type Role } from "@/core/permissions";

/** "Assign action" button that opens the add-action form on Management actions with the title and evidence filled in. Shown only to people who may add actions. */
export function AssignActionLink({ role, title, evidence, responsible, label = "Assign action →" }: { role: Role; title: string; evidence?: string; responsible?: string; label?: string }) {
  if (!canManageActions(role)) return null;
  return (
    <Link href={addActionHref({ title, evidence, responsible })} className="inline-block rounded-md border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft">
      {label}
    </Link>
  );
}
