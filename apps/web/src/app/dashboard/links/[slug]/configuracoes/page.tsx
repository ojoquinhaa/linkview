import { can } from "@linkview/auth/permissions";
import { notFound, redirect } from "next/navigation";
import { LinkSettingsForm } from "@/components/dashboard/link-settings-form";
import { systemDomain } from "@/lib/env";
import { getLinkBySlug } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function LinkSettingsPage({
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
    <LinkSettingsForm
      linkId={link.id}
      slug={link.slug}
      domain={systemDomain()}
      link={{
        destinationUrl: link.destinationUrl,
        title: link.title,
        description: link.description,
        isActive: link.isActive,
      }}
      canEdit={can(workspace.role, "link.edit")}
    />
  );
}
