"use client";

import { useEffect } from "react";
import { BackButton, RetryButton } from "@/components/error-actions";
import { ErrorScreen } from "@/components/error-screen";

/**
 * Route-segment error boundary (HTTP 500-class failures). `reset()` re-renders
 * the failed segment, so retrying is the primary action; going back is the
 * escape hatch. The digest is logged for correlation with server logs.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app.render_error", error);
  }, [error]);

  return (
    <ErrorScreen
      variant="500"
      eyebrow="Erro"
      title="Algo quebrou do nosso lado."
      body="Um erro inesperado interrompeu esta página. Já registramos o ocorrido. Tente de novo em instantes; se persistir, volte mais tarde."
    >
      <RetryButton label="Tentar de novo" onRetry={reset} />
      <BackButton label="Voltar" />
    </ErrorScreen>
  );
}
