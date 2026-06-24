"use client";
import { cn } from "@/lib/cn";

/** Score a password 0-4 from length and character variety (no library). */
export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const LABELS = ["", "fraca", "razoável", "boa", "forte"] as const;
// Indigo accent at full strength; warm-to-cool ramp before that.
const COLORS = [
  "var(--line-strong)",
  "var(--danger)",
  "oklch(0.72 0.15 75)",
  "oklch(0.6 0.13 152)",
  "var(--accent)",
] as const;

/** Four-segment strength meter shown under the password field. */
export function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password);
  const active = COLORS[score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            className="h-1 flex-1 rounded-full transition-[background-color] duration-200 ease-[var(--ease-out-quint)]"
            style={{
              backgroundColor: score >= seg ? active : "var(--line)",
            }}
          />
        ))}
      </div>
      {password && (
        <p
          className={cn(
            "mt-1.5 text-[0.75rem]",
            score >= 3 ? "text-ink-soft" : "text-muted",
          )}
        >
          Senha {LABELS[score]}
          {score < 2 && ". Use 8+ caracteres, com letras e números."}
        </p>
      )}
    </div>
  );
}
