"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * A password field with a Show / Hide button, so what the browser filled in (or what was typed) can be read instead of
 * dots. It only changes how the field is displayed here: nothing extra is stored, and the field starts hidden.
 */
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 mt-1 px-3 text-xs font-semibold text-brand underline-offset-2 hover:underline"
      >
        {visible ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </div>
  );
}
