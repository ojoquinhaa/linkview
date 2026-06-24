import { can } from "@linkview/auth/permissions";
import { getPlan, type PlanKey } from "@linkview/shared";
import { notFound, redirect } from "next/navigation";
import { BioEditor } from "@/components/dashboard/bio-editor";
import { systemDomain } from "@/lib/env";
import { getBioPage } from "@/server/bio-pages-query";
import { listLinks } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function EditBioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) redirect("/login");

  const planKey = (workspace.planKey as PlanKey) ?? "free";
  if (!getPlan(planKey).bioPagesEnabled) redirect("/dashboard/paginas");

  const { id } = await params;
  const page = await getBioPage(workspace.id, id);
  if (!page) notFound();

  const canEdit = can(workspace.role, "link.edit");
  const canDelete = can(workspace.role, "link.delete");
  const domain = systemDomain();

  // Workspace links offered in the "add tracked link" picker.
  const links = await listLinks(workspace.id);
  const linkOptions = links.map((l) => ({
    label: l.title || l.slug,
    shortUrl: `https://${domain}/${l.slug}`,
    totalClicks: l.totalClicks,
  }));

  return (
    <BioEditor
      page={page}
      publicUrl={`https://${domain}/p/${page.slug}`}
      linkOptions={linkOptions}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
