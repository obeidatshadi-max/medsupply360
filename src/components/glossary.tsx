import { GLOSSARY, PAGE_TERMS } from "@/core/glossary";

/** Short list of the business terms used on a screen, in simple words. Collapsed: the cards already explain their own terms. */
export function Glossary({ page }: { page: keyof typeof PAGE_TERMS }) {
  const terms = PAGE_TERMS[page] ?? [];
  if (terms.length === 0) return null;
  return (
    <details aria-label="Business terms in simple words" className="mt-8 rounded-[9px] border border-line bg-white px-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Business terms in simple words</summary>
      <dl className="grid pb-4 pt-1 gap-x-8 gap-y-1.5 text-xs md:grid-cols-2">
        {terms.map((t) => (
          <div key={t}>
            <dt className="inline font-semibold">{t}: </dt>
            <dd className="inline text-muted">{GLOSSARY[t]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
