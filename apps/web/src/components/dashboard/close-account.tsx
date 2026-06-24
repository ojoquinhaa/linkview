"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { authClient } from "@/lib/auth-client";
import { closeAccountAction } from "@/server/account";

const CONFIRM = "ENCERRAR";

export function CloseAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setError(null);
    setLoading(true);
    const res = await closeAccountAction();
    if (!res.ok) {
      setError(res.error ?? "Não foi possível encerrar.");
      setLoading(false);
      return;
    }
    // Sessions are already revoked server-side; clear the client cookie too,
    // then leave the authenticated area for good.
    await authClient.signOut().catch(() => {});
    router.push("/login");
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Encerrar conta
      </Button>

      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title="Encerrar sua conta?"
        description="Esta ação é permanente. Seus links param de funcionar e seus dados são removidos conforme a LGPD."
      >
        <div className="flex flex-col gap-4">
          <label
            htmlFor="confirm-close"
            className="text-[0.85rem] text-ink-soft"
          >
            Para confirmar, digite{" "}
            <span className="font-mono font-semibold text-ink">{CONFIRM}</span>{" "}
            abaixo.
          </label>
          <Input
            id="confirm-close"
            value={typed}
            autoComplete="off"
            placeholder={CONFIRM}
            invalid={Boolean(error)}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
          />

          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
            >
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              loading={loading}
              disabled={typed !== CONFIRM}
            >
              Encerrar conta
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
