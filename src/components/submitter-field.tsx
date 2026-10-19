"use client";

import { useId, useSyncExternalStore } from "react";
import { SUBMITTER_FIELD, SUBMITTER_MAX } from "@/core/submitter";

const KEY = "medsupply360.submitter";
const EVENT = "medsupply360-submitter";

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function write(name: string) {
  try {
    window.localStorage.setItem(KEY, name);
  } catch {
    // Storage blocked (private window): the field simply starts empty next time.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * "Your name" for a data form. The department shares one sign-in, so each person types their own name; the date and time
 * are set by the server. The last name used on this computer is filled in again so staff only retype it when someone
 * else takes over. `compact` is the small version for one-button forms such as Remove.
 */
export function SubmitterField({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const saved = useSyncExternalStore(subscribe, read, () => "");
  const input = (
    <input
      // A new key re-applies the remembered name after React resets the form following a save.
      key={saved}
      id={id}
      name={SUBMITTER_FIELD}
      required
      minLength={2}
      maxLength={SUBMITTER_MAX}
      autoComplete="name"
      defaultValue={saved}
      placeholder={compact ? "Your name" : undefined}
      aria-label={compact ? "Your name" : undefined}
      onChange={(e) => write(e.target.value.trim())}
      className={
        compact
          ? "rounded-md border border-line bg-white px-2 py-1 text-xs"
          : "mt-1 block w-full rounded-md border border-line bg-white px-3 py-2 text-sm md:max-w-sm"
      }
    />
  );
  if (compact) return input;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        Your name
      </label>
      {input}
      <p className="mt-1 text-xs text-muted">Saved with this change together with the date and time, so the history shows who made it.</p>
    </div>
  );
}
