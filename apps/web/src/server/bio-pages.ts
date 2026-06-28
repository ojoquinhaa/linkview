"use server";
import { can } from "@linkview/auth/permissions";
import { bioPageLinks, bioPages, getDb } from "@linkview/db";
import {
  getPlan,
  normalizeSlug,
  type PlanKey,
  validateSlug,
} from "@linkview/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { LOCKED_WRITE_MESSAGE, workspaceCanWrite } from "./billing/guard";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

const LOCKED = LOCKED_WRITE_MESSAGE;

interface Ok<T = undefined> {
  ok: true;
  data?: T;
}
interface Err {
  ok: false;
  error: string;
}
type Result<T = undefined> = Ok<T> | Err;

async function ctx() {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) throw new Error("no-workspace");
  return { session, workspace };
}

/** Confirm a bio page belongs to the active workspace (and editor can edit). */
async function assertOwnsPage(workspaceId: string, pageId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: bioPages.id })
    .from(bioPages)
    .where(
      and(
        eq(bioPages.id, pageId),
        eq(bioPages.workspaceId, workspaceId),
        isNull(bioPages.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function createBioPage(input: {
  slug: string;
  title: string;
}): Promise<Result<{ id: string }>> {
  const { workspace } = await ctx();
  if (!can(workspace.role, "link.create")) {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED };
  }
  if (!getPlan(workspace.planKey as PlanKey).bioPagesEnabled) {
    return { ok: false, error: "Seu plano não inclui páginas de links." };
  }

  const slug = normalizeSlug(input.slug);
  const slugError = validateSlug(slug);
  if (slugError) {
    return { ok: false, error: "Escolha um endereço válido (3+ caracteres)." };
  }
  const title = input.title.trim().slice(0, 120) || null;

  const db = getDb();
  const [existing] = await db
    .select({ id: bioPages.id })
    .from(bioPages)
    .where(eq(bioPages.slug, slug))
    .limit(1);
  if (existing) {
    return { ok: false, error: "Esse endereço já está em uso." };
  }

  const [row] = await db
    .insert(bioPages)
    .values({ workspaceId: workspace.id, slug, title })
    .returning({ id: bioPages.id });
  if (!row) throw new Error("Não foi possível criar a página.");
  revalidatePath("/dashboard/paginas");
  return { ok: true, data: { id: row.id } };
}

export async function updateBioPageMeta(
  pageId: string,
  input: {
    title: string;
    description: string;
    avatarUrl: string;
    theme: string;
    isActive: boolean;
  },
): Promise<Result> {
  const { workspace } = await ctx();
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await assertOwnsPage(workspace.id, pageId))) {
    return { ok: false, error: "Página não encontrada." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED };
  }
  const db = getDb();
  await db
    .update(bioPages)
    .set({
      title: input.title.trim().slice(0, 120) || null,
      description: input.description.trim().slice(0, 280) || null,
      avatarUrl: input.avatarUrl.trim() || null,
      theme: input.theme,
      isActive: input.isActive,
    })
    .where(eq(bioPages.id, pageId));
  revalidatePath("/dashboard/paginas");
  revalidatePath(`/dashboard/paginas/${pageId}`);
  return { ok: true };
}

export async function deleteBioPage(pageId: string): Promise<Result> {
  const { workspace } = await ctx();
  if (!can(workspace.role, "link.delete")) {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await assertOwnsPage(workspace.id, pageId))) {
    return { ok: false, error: "Página não encontrada." };
  }
  const db = getDb();
  await db
    .update(bioPages)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(bioPages.id, pageId));
  revalidatePath("/dashboard/paginas");
  return { ok: true };
}

export async function addBioLink(
  pageId: string,
  input: { label: string; url: string },
): Promise<Result> {
  const { workspace } = await ctx();
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await assertOwnsPage(workspace.id, pageId))) {
    return { ok: false, error: "Página não encontrada." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED };
  }
  const label = input.label.trim().slice(0, 120);
  const url = input.url.trim().slice(0, 2048);
  if (!label) return { ok: false, error: "Dê um nome ao botão." };
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "Informe um link válido (https://…)." };
  }

  const db = getDb();
  const [{ next } = { next: 0 }] = await db
    .select({
      next: sql<number>`coalesce(max(${bioPageLinks.position}) + 1, 0)`,
    })
    .from(bioPageLinks)
    .where(eq(bioPageLinks.bioPageId, pageId));
  await db.insert(bioPageLinks).values({
    bioPageId: pageId,
    label,
    url,
    position: next,
  });
  revalidatePath(`/dashboard/paginas/${pageId}`);
  return { ok: true };
}

/** Confirm a bio link belongs to a page the workspace owns. */
async function assertOwnsLink(workspaceId: string, linkId: string) {
  const db = getDb();
  const [row] = await db
    .select({ pageId: bioPageLinks.bioPageId })
    .from(bioPageLinks)
    .innerJoin(bioPages, eq(bioPages.id, bioPageLinks.bioPageId))
    .where(
      and(eq(bioPageLinks.id, linkId), eq(bioPages.workspaceId, workspaceId)),
    )
    .limit(1);
  return row?.pageId ?? null;
}

export async function updateBioLink(
  linkId: string,
  input: { label: string; url: string; isActive: boolean },
): Promise<Result> {
  const { workspace } = await ctx();
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão." };
  }
  const pageId = await assertOwnsLink(workspace.id, linkId);
  if (!pageId) return { ok: false, error: "Botão não encontrado." };
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED };
  }
  const label = input.label.trim().slice(0, 120);
  const url = input.url.trim().slice(0, 2048);
  if (!label) return { ok: false, error: "Dê um nome ao botão." };
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "Informe um link válido (https://…)." };
  }
  const db = getDb();
  await db
    .update(bioPageLinks)
    .set({ label, url, isActive: input.isActive })
    .where(eq(bioPageLinks.id, linkId));
  revalidatePath(`/dashboard/paginas/${pageId}`);
  return { ok: true };
}

export async function deleteBioLink(linkId: string): Promise<Result> {
  const { workspace } = await ctx();
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão." };
  }
  const pageId = await assertOwnsLink(workspace.id, linkId);
  if (!pageId) return { ok: false, error: "Botão não encontrado." };
  const db = getDb();
  await db.delete(bioPageLinks).where(eq(bioPageLinks.id, linkId));
  revalidatePath(`/dashboard/paginas/${pageId}`);
  return { ok: true };
}

/**
 * Persist a new button order. Two-pass to satisfy the unique
 * (bio_page_id, position) constraint: park rows at high offsets, then settle.
 */
export async function reorderBioLinks(
  pageId: string,
  orderedIds: string[],
): Promise<Result> {
  const { workspace } = await ctx();
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await assertOwnsPage(workspace.id, pageId))) {
    return { ok: false, error: "Página não encontrada." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED };
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(bioPageLinks)
        .set({ position: 1000 + i })
        .where(
          and(eq(bioPageLinks.id, id), eq(bioPageLinks.bioPageId, pageId)),
        );
    }
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(bioPageLinks)
        .set({ position: i })
        .where(
          and(eq(bioPageLinks.id, id), eq(bioPageLinks.bioPageId, pageId)),
        );
    }
  });
  revalidatePath(`/dashboard/paginas/${pageId}`);
  return { ok: true };
}
