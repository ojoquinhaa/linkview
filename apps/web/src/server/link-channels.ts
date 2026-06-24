"use server";
import { can } from "@linkview/auth/permissions";
import { getDb, linkChannels, links } from "@linkview/db";
import { type CreateChannelInput, createChannelSchema } from "@linkview/shared";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logAudit } from "./audit";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

export interface ChannelResult {
  ok: boolean;
  error?: string;
}

/** Lowercase, hyphenate, strip anything that is not a-z0-9. */
function normalizeSource(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ownedLink(id: string, workspaceId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: links.id, slug: links.slug })
    .from(links)
    .where(
      and(
        eq(links.id, id),
        eq(links.workspaceId, workspaceId),
        isNull(links.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createChannelAction(
  linkId: string,
  input: CreateChannelInput,
): Promise<ChannelResult> {
  const parsed = createChannelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;
  const source = normalizeSource(data.utmSource);
  if (!source) return { ok: false, error: "Origem inválida." };

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  const link = await ownedLink(linkId, workspace.id);
  if (!link) return { ok: false, error: "Link não encontrado." };

  const db = getDb();
  try {
    await db.insert(linkChannels).values({
      workspaceId: workspace.id,
      linkId,
      name: data.name.trim(),
      utmSource: source,
      utmMedium: data.utmMedium?.trim() || null,
      utmCampaign: data.utmCampaign?.trim() || null,
    });
  } catch (err) {
    if (String(err).includes("link_channels_link_source_unique")) {
      return {
        ok: false,
        error: `Já existe um canal com a origem "${source}".`,
      };
    }
    console.error("channel.create_failed", err);
    return { ok: false, error: "Não foi possível criar o canal." };
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.channel_created",
    entityType: "link",
    entityId: linkId,
  });

  revalidatePath(`/dashboard/links/${link.slug}/canais`);
  return { ok: true };
}

export async function deleteChannelAction(
  channelId: string,
): Promise<ChannelResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }

  const db = getDb();
  const [channel] = await db
    .select({ id: linkChannels.id, linkId: linkChannels.linkId })
    .from(linkChannels)
    .where(
      and(
        eq(linkChannels.id, channelId),
        eq(linkChannels.workspaceId, workspace.id),
      ),
    )
    .limit(1);
  if (!channel) return { ok: false, error: "Canal não encontrado." };

  await db.delete(linkChannels).where(eq(linkChannels.id, channelId));

  const link = await ownedLink(channel.linkId, workspace.id);
  if (link) revalidatePath(`/dashboard/links/${link.slug}/canais`);
  return { ok: true };
}
