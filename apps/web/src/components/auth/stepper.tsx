"use client";
import { cn } from "@/lib/cn";

export interface StepperProps {
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
}

/**
 * Horizontal progress indicator for the registration flow. Conveys "where am I
 * and how much is left" without stealing attention: done steps fill with
 * accent, the current one is ringed, upcoming ones stay quiet. The connecting
 * track fills left-to-right as steps complete.
 */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center" aria-label="Progresso do cadastro">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const isLast = i === steps.length - 1;
        return (
          <li
            key={label}
            className={cn("flex items-center", !isLast && "flex-1")}
            aria-current={active ? "step" : undefined}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full border text-[0.78rem] font-semibold transition-[background-color,border-color,color] duration-200 ease-[var(--ease-out-quint)]",
                  done && "border-accent bg-accent text-accent-ink",
                  active &&
                    "border-accent bg-surface text-accent shadow-[0_0_0_3px_var(--accent-weak)]",
                  !done && !active && "border-line bg-surface text-muted",
                )}
              >
                {done ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="size-3.5"
                  >
                    <path
                      d="M3.5 8.5l3 3 6-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[0.72rem] font-medium transition-colors",
                  active ? "text-ink" : "text-muted",
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden
                className="relative mx-2 mb-5 h-px flex-1 overflow-hidden bg-line"
              >
                <span
                  className="absolute inset-0 origin-left bg-accent transition-transform duration-300 ease-[var(--ease-out-quint)]"
                  style={{ transform: `scaleX(${done ? 1 : 0})` }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
