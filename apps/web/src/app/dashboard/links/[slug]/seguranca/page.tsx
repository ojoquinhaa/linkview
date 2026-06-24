import { can } from "@linkview/auth/permissions";
import { notFound, redirect } from "next/navigation";
import { LinkSecurityForm } from "@/components/dashboard/link-security-form";
import { getLinkBySlug } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function LinkSecurityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const { slug } = await params;
  const link = await getLinkBySlug(workspace.id, slug);
  if (!link) notFound();

  return (
    <LinkSecurityForm
      linkId={link.id}
      canEdit={can(workspace.role, "link.edit")}
      link={{
        isActive: link.isActive,
        hasPassword: link.hasPassword,
        expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
        maxClicks: link.maxClicks,
        totalClicks: link.totalClicks,
        blockBots: link.blockBots,
        allowedCountries: link.allowedCountries ?? [],
        blockedCountries: link.blockedCountries ?? [],
        rateLimitPerMinute: link.rateLimitPerMinute,
      }}
    />
  );
}
