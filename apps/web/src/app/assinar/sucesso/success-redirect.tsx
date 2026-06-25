"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const DASHBOARD = "/dashboard/links";

/**
 * Primary CTA into the dashboard with a gentle auto-redirect. The button is
 * always there for anyone who'd rather not wait; the countdown just means the
 * flow never strands a customer on a dead-end success page.
 */
export function SuccessRedirect({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const tick = setInterval(() => {
      setLeft((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    const go = setTimeout(() => router.push(DASHBOARD), seconds * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [router, seconds]);

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        onClick={() => router.push(DASHBOARD)}
      >
        Ir para o painel
      </Button>
      <p className="mt-3 text-[0.8rem] text-muted" aria-live="polite">
        {left > 0
          ? `Levando você para o painel em ${left}s…`
          : "Levando você para o painel…"}
      </p>
    </>
  );
}
