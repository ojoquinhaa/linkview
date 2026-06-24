"use client";
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Static text shown inside the control before the input (e.g. a domain). */
  prefix?: string;
  /** Forwarded to the underlying <input> (React 19 ref-as-prop). */
  ref?: Ref<HTMLInputElement>;
}

const fieldShell =
  "flex h-11 w-full items-center rounded-[var(--radius-input)] border bg-surface text-sm transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)]";

export function Input({ invalid, prefix, className, ...props }: InputProps) {
  return (
    <div
      className={cn(
        fieldShell,
        "border-line focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--ring)]",
        invalid &&
          "border-danger focus-within:border-danger focus-within:shadow-[0_0_0_3px_oklch(0.53_0.18_25/0.25)]",
        className,
      )}
    >
      {prefix && (
        <span className="pl-3.5 pr-0 font-mono text-[0.82rem] text-muted">
          {prefix}
        </span>
      )}
      <input
        className={cn(
          "h-full w-full rounded-[var(--radius-input)] bg-transparent px-3.5 text-ink outline-none placeholder:text-muted/80",
          prefix && "pl-1 font-mono",
        )}
        {...props}
      />
    </div>
  );
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full resize-y rounded-[var(--radius-input)] border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-quint)] placeholder:text-muted/80",
        "border-line focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)]",
        invalid &&
          "border-danger focus:border-danger focus:shadow-[0_0_0_3px_oklch(0.53_0.18_25/0.25)]",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (props: { id: string; invalid: boolean }) => ReactNode;
  htmlFor?: string;
}) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.82rem] font-medium text-ink-soft">
        {label}
      </label>
      {children({ id, invalid: Boolean(error) })}
      {error ? (
        <p className="text-[0.8rem] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[0.8rem] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
