"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toggleLinkAction } from "@/server/links";

export function PauseLinkModal({
  open,
  onClose,
  id,
  label,
  onPaused,
}: {
  open: boolean;
  onClose: () => void;
  id: string;
  /** Human-readable identifier shown in the confirmation (slug or short URL). */
  label: string;
  onPaused?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await toggleLinkAction(id, false);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível pausar.");
        return;
      }
      onPaused?.();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pausar link"
      description="Você pode reativá-lo a qualquer momento."
    >
      <p className="text-[0.9rem] text-ink-soft">
        O link <span className="font-mono font-medium text-ink">{label}</span>{" "}
        para de redirecionar na hora — quem acessar verá uma página de link
        desativado. As métricas já coletadas continuam disponíveis.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-input)] border border-danger/30 bg-danger-weak px-3.5 py-2.5 text-[0.83rem] text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={confirm}
        >
          Pausar link
        </Button>
      </div>
    </Modal>
  );
}
