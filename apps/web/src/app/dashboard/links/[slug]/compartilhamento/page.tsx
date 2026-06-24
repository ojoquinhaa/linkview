import { can } from "@linkview/auth/permissions";
import { notFound, redirect } from "next/navigation";
import { OgEditor } from "@/components/dashboard/og-editor";
import { r2Configured, systemDomain } from "@/lib/env";
import { getLinkBySlug } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function LinkSharePage({
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
    <OgEditor
      linkId={link.id}
      slug={link.slug}
      domain={systemDomain()}
      link={{
        title: link.title,
        description: link.description,
        destinationUrl: link.destinationUrl,
        ogTitle: link.ogTitle,
        ogDescription: link.ogDescription,
        ogImageUrl: link.ogImageUrl,
      }}
      canEdit={can(workspace.role, "link.edit")}
      uploadEnabled={r2Configured()}
    />
  );
}
