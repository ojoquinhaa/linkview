"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deletePageLayoutAction } from "@/server/page-layouts";

export function LayoutDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const res = await deletePageLayoutAction(id);
      if (res.ok) {
        router.push("/dashboard/paginas");
        router.refresh();
      } else {
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Excluir
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.82rem] text-muted">Excluir esta página?</span>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
      <Button variant="danger" size="sm" loading={pending} onClick={onDelete}>
        Excluir
      </Button>
    </div>
  );
}
