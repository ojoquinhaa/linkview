import { LinksTable } from "@/components/admin/links-table";
import { listLinks } from "@/server/admin/links";
import { getSystemDomain } from "@/server/domain";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export default async function AdminLinksPage() {
  const [rows, domain] = await Promise.all([listLinks(300), getSystemDomain()]);

  return (
    <div className="flex flex-col">
      <div className="border-b border-line bg-paper px-6 py-6 sm:px-8">
        <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
          Links
        </h1>
        <p className="mt-1 text-[0.9rem] text-muted">
          {rows.length === 1
            ? "1 link na plataforma."
            : `${fmtNum(rows.length)} links na plataforma.`}{" "}
          Busque por código, destino ou dono e clique para gerenciar.
        </p>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-[0.9rem] text-muted">
            Nenhum link ainda.
          </p>
        ) : (
          <LinksTable links={rows} hostname={domain.hostname} />
        )}
      </div>
    </div>
  );
}
