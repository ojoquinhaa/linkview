import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateLink } from "@/components/dashboard/create-link";
import { CreateLinkTour } from "@/components/onboarding/link-tours";
import { systemDomain } from "@/lib/env";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function NewLinkPage() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const domain = systemDomain();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-6 py-8 sm:py-10">
      <Link
        href="/dashboard/links"
        className="inline-flex w-fit items-center gap-1.5 text-[0.83rem] font-medium text-muted transition-colors hover:text-ink"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Todos os links
      </Link>

      <header>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.02em] text-ink">
            Criar link
          </h1>
          <div className="pt-1">
            <CreateLinkTour />
          </div>
        </div>
        <p className="mt-1 text-[0.92rem] text-muted">
          Monte um link de site, WhatsApp, Instagram, telefone ou e-mail e
          receba o QR Code na hora.
        </p>
      </header>

      <CreateLink domain={domain} />
    </div>
  );
}
