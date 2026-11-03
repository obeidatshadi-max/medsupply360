import { PAGE_TERMS, glossaryEntry, hasMore } from "@/core/glossary";

/** List of the business terms used on a screen, in simple words. Collapsed: the cards already explain their own terms. Terms with more to say have a "Learn more" section. */
export function Glossary({ page }: { page: keyof typeof PAGE_TERMS }) {
  const entries = (PAGE_TERMS[page] ?? []).map((t) => glossaryEntry(t)).filter((e) => e !== undefined);
  if (entries.length === 0) return null;
  return (
    <details aria-label="Business terms in simple words" className="mt-8 rounded-[9px] border border-line bg-white px-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Business terms in simple words</summary>
      <dl className="grid pb-4 pt-1 gap-x-8 gap-y-2 text-xs md:grid-cols-2">
        {entries.map((e) => (
          <div key={e.id}>
            <dt className="inline font-semibold">{e.term}: </dt>
            <dd className="inline text-muted">{e.short}</dd>
            {hasMore(e) ? (
              <details className="mt-1 rounded bg-canvas px-2 py-1">
                <summary className="cursor-pointer font-semibold text-brand">Learn more about {e.term}</summary>
                <ul className="mt-1 list-none space-y-1 pb-1">
                  {e.example ? (
                    <li>
                      <b>Example: </b>
                      {e.example}
                    </li>
                  ) : null}
                  {e.why ? (
                    <li>
                      <b>Why it matters: </b>
                      {e.why}
                    </li>
                  ) : null}
                  {e.action ? (
                    <li>
                      <b>What you can do: </b>
                      {e.action}
                    </li>
                  ) : null}
                </ul>
              </details>
            ) : null}
          </div>
        ))}
      </dl>
    </details>
  );
}
