"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { sendVerificationEmail } from "@/lib/auth-client";

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerificarEmail />
    </Suspense>
  );
}

function VerificarEmail() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [loading, setLoading] = useState(false);

  async function resend() {
    if (!email) return;
    setLoading(true);
    const { error } = await sendVerificationEmail({
      email,
      // After confirming their e-mail, land on the subscription step so the
      // user can pick the free trial or Pro checkout.
      callbackURL: "/assinar",
    });
    setLoading(false);
    setStatus(error ? "error" : "sent");
  }

  return (
    <div>
      <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
        Confirme seu e-mail
      </h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">
        Enviamos um link de confirmação
        {email ? (
          <>
            {" "}
            para <span className="text-ink">{email}</span>
          </>
        ) : null}
        . Clique nele para ativar sua conta e começar a criar links. Confira
        também o spam.
      </p>

      {status === "sent" && (
        <p className="mt-5 rounded-[var(--radius-input)] border border-ok/30 bg-accent-weak px-3.5 py-2.5 text-[0.85rem] text-accent-deep">
          Reenviamos o e-mail. Verifique sua caixa de entrada.
        </p>
      )}
      {status === "error" && (
        <p className="mt-5 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.85rem] text-danger">
          Não foi possível reenviar agora. Tente novamente em instantes.
        </p>
      )}

      {email && (
        <Button
          type="button"
          variant="secondary"
          loading={loading}
          onClick={resend}
          className="mt-6"
        >
          Reenviar e-mail
        </Button>
      )}

      <p className="mt-7 text-[0.9rem] text-muted">
        Já confirmou?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
