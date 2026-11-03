import { accountHref } from "@/lib/nav";

/**
 * A customer's name as a link to that customer on the Accounts page, so a name seen anywhere leads to its sales and balances.
 * `plain` shows only the name, for people who may not open the Accounts page (the maintenance department).
 */
export function CustomerLink({ code, name, plain = false }: { code: string; name: string; plain?: boolean }) {
  if (plain) return <>{name}</>;
  return (
    <a href={accountHref(code)} className="underline decoration-line underline-offset-2 hover:decoration-brand">
      {name}
    </a>
  );
}
