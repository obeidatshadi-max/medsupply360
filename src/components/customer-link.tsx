import { accountHref } from "@/lib/nav";

/** A customer's name as a link to that customer on the Accounts page, so a name seen anywhere leads to its sales and balances. */
export function CustomerLink({ code, name }: { code: string; name: string }) {
  return (
    <a href={accountHref(code)} className="underline decoration-line underline-offset-2 hover:decoration-brand">
      {name}
    </a>
  );
}
