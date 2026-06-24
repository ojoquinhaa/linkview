import { SettingsTabs } from "@/components/dashboard/settings-tabs";

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {/* Title band, flush under the topbar (same paper tone as Links/Planos). */}
      <div className="bg-paper px-6 pt-6 sm:px-8">
        <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
          Configurações
        </h1>
        <p className="mt-1 text-[0.9rem] text-muted">
          Seu perfil, segurança e workspace, num lugar só.
        </p>

        <div className="mt-4 border-b border-line">
          <SettingsTabs />
        </div>
      </div>

      {/* Active tab content. */}
      <div className="px-6 py-7 sm:px-8">{children}</div>
    </div>
  );
}
