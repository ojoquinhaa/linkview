import { can } from "@linkview/auth/permissions";
import { notFound, redirect } from "next/navigation";
import { QrCodesManager } from "@/components/dashboard/qr-codes-manager";
import { systemDomain } from "@/lib/env";
import { getLinkBySlug, getLinkQrCodes } from "@/server/links-query";
import { requireSession } from "@/server/session";
import { getActiveWorkspace } from "@/server/workspace";

export default async function LinkQrCodesPage({
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

  const qrCodes = await getLinkQrCodes(link.id);
  const canEdit = can(workspace.role, "link.edit");

  return (
    <QrCodesManager
      linkId={link.id}
      slug={link.slug}
      domain={systemDomain()}
      qrCodes={qrCodes}
      canEdit={canEdit}
    />
  );
}
