"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { glossaryEntry, hasMore, type Term } from "@/core/glossary";

/**
 * A term with a small (i) button. Tap, click, Enter or Space opens a short explanation next to it; Escape or a tap outside closes it.
 * Nothing depends on hover, so it works on a phone and with a keyboard or screen reader.
 *
 * Do not put it inside a link or another button: the (i) is a button of its own.
 * Use it on a few terms that change how a number is read, not on every word.
 */
export function InfoTerm({ term, children }: { term: Term; children?: ReactNode }) {
  const entry = glossaryEntry(term);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const moreId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep the panel on screen: if it would run past the right edge, open it towards the left.
  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const left = wrap.current?.getBoundingClientRect().left ?? 0;
    setAlignRight(left + panel.current.offsetWidth > window.innerWidth - 8);
  }, [open]);

  if (!entry) return <>{children ?? term}</>;

  return (
    <span ref={wrap} className="relative inline-flex items-center gap-1 align-baseline">
      <span>{children ?? term}</span>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`What does ${entry.term} mean?`}
        onClick={() => {
          setOpen((v) => !v);
          setMore(false);
        }}
        className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted text-[10px] font-bold leading-none text-muted before:absolute before:-inset-3 before:content-[''] hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span aria-hidden>i</span>
      </button>
      {open ? (
        <span
          ref={panel}
          id={panelId}
          role="group"
          aria-label={entry.term}
          className={`absolute top-full z-30 mt-2 block w-64 max-w-[calc(100vw-2rem)] rounded-[9px] border border-line bg-white p-3 text-left text-xs font-normal normal-case leading-snug tracking-normal text-ink shadow-lg ${alignRight ? "right-0" : "left-0"}`}
        >
          <span className="block font-semibold">{entry.term}</span>
          <span className="mt-1 block text-muted">{entry.short}</span>
          {hasMore(entry) ? (
            <span className="mt-2 block border-t border-line pt-2">
              <button
                type="button"
                aria-expanded={more}
                aria-controls={moreId}
                onClick={() => setMore((v) => !v)}
                className="font-semibold text-brand underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {more ? "Show less" : "Learn more"}
              </button>
              <span id={moreId} className={more ? "block" : "hidden"}>
                {entry.example ? (
                  <span className="mt-1.5 block">
                    <b>Example: </b>
                    {entry.example}
                  </span>
                ) : null}
                {entry.why ? (
                  <span className="mt-1.5 block">
                    <b>Why it matters: </b>
                    {entry.why}
                  </span>
                ) : null}
                {entry.action ? (
                  <span className="mt-1.5 block">
                    <b>What you can do: </b>
                    {entry.action}
                  </span>
                ) : null}
              </span>
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
