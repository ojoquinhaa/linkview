import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBioTheme } from "@/lib/bio-themes";
import { getPublicBioPage } from "@/server/bio-pages-query";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicBioPage(slug);
  if (!page) return { title: "Página não encontrada" };
  const title = page.title ?? slug;
  return {
    title,
    description: page.description ?? undefined,
    openGraph: {
      title,
      description: page.description ?? undefined,
      images: page.avatarUrl ? [page.avatarUrl] : undefined,
    },
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function BioPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicBioPage(slug);
  if (!page) notFound();

  const t = getBioTheme(page.theme);
  const name = page.title ?? slug;

  return (
    <main
      style={{
        background: t.background,
        color: t.text,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "56px 20px 40px",
        fontFamily:
          "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 540 }}>
        <header
          style={{
            textAlign: "center",
            display: "grid",
            justifyItems: "center",
          }}
        >
          <Avatar url={page.avatarUrl} name={name} theme={t} />
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            {name}
          </h1>
          {page.description && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 15,
                lineHeight: 1.5,
                color: t.muted,
                maxWidth: 420,
              }}
            >
              {page.description}
            </p>
          )}
        </header>

        <nav
          style={{
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {page.links.length === 0 ? (
            <p style={{ textAlign: "center", color: t.muted, fontSize: 14 }}>
              Nenhum link por aqui ainda.
            </p>
          ) : (
            page.links.map((link, i) => (
              <a
                // biome-ignore lint/suspicious/noArrayIndexKey: stable order list
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bio-btn"
                style={{
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                  padding: "16px 18px",
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 600,
                  color: t.buttonText,
                  background: t.button,
                  border: `1px solid ${t.buttonBorder}`,
                  // @ts-expect-error CSS custom property for the hover rule
                  "--bio-hover": t.buttonHover,
                }}
              >
                {link.label}
              </a>
            ))
          )}
        </nav>

        <footer style={{ marginTop: 40, textAlign: "center", fontSize: 12.5 }}>
          <a
            href="https://linkview.com.br"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: t.muted, textDecoration: "none", fontWeight: 600 }}
          >
            Criado com linkview
          </a>
        </footer>
      </div>

      <style
        // Hover/active feedback without a client component.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static theme CSS
        dangerouslySetInnerHTML={{
          __html:
            ".bio-btn{transition:transform .12s ease,background .12s ease}.bio-btn:hover{background:var(--bio-hover)!important;transform:translateY(-1px)}.bio-btn:active{transform:translateY(0)}",
        }}
      />
    </main>
  );
}

function Avatar({
  url,
  name,
  theme,
}: {
  url: string | null;
  name: string;
  theme: ReturnType<typeof getBioTheme>;
}) {
  const size = 88;
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: arbitrary external avatar URL
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: `2px solid ${theme.buttonBorder}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: 30,
        fontWeight: 700,
        color: theme.buttonText,
        background: theme.button,
        border: `1px solid ${theme.buttonBorder}`,
      }}
    >
      {initials(name) || "•"}
    </div>
  );
}
