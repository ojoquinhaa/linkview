import { can } from "@linkview/auth/permissions";
import { notFound, redirect } from "next/navigation";
import { ChannelsManager } from "@/components/dashboard/channels-manager";
import { systemDomain } from "@/lib/env";
import { getLinkBySlug, getLinkChannels } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function LinkChannelsPage({
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

  const channels = await getLinkChannels(link.id);
  const canEdit = can(workspace.role, "link.edit");

  return (
    <ChannelsManager
      linkId={link.id}
      slug={link.slug}
      domain={systemDomain()}
      channels={channels}
      canEdit={canEdit}
    />
  );
}
