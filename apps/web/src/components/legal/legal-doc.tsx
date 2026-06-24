import type { ReactNode } from "react";

/** Shared typographic shell for the Terms and Privacy long-form pages. */
export function LegalDoc({
  title,
  updated,
  version,
  intro,
  children,
}: {
  title: string;
  updated: string;
  version: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <article>
      <p className="text-[0.78rem] font-medium uppercase tracking-[0.12em] text-accent">
        Documento legal
      </p>
      <h1 className="mt-2 font-display text-[2.1rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
        {title}
      </h1>
      <p className="mt-3 text-[0.85rem] text-muted">
        Última atualização: {updated} · Versão {version}
      </p>
      <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3.5 text-[0.9rem] leading-relaxed text-ink-soft">
        {intro}
      </div>
      <div className="mt-8 flex flex-col gap-8">{children}</div>
      <p className="mt-12 border-t border-line pt-6 text-[0.8rem] leading-relaxed text-muted">
        Este texto é um modelo de boas práticas alinhado à LGPD (Lei nº
        13.709/2018) e ao Marco Civil da Internet (Lei nº 12.965/2014).
        Recomenda-se revisão por advogado antes do uso em produção.
      </p>
    </article>
  );
}

/** A numbered section with heading and body. */
export function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-[1.15rem] font-semibold tracking-[-0.01em] text-ink">
        <span className="text-muted">{n}.</span> {title}
      </h2>
      <div className="mt-2.5 flex flex-col gap-2.5 text-[0.92rem] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list with brand-tinted markers. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static authored legal copy, stable order
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="mt-[0.55em] size-1 shrink-0 rounded-full bg-accent"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
