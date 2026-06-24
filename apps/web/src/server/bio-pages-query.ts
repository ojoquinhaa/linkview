import "server-only";
import { bioPageLinks, bioPages, getDb } from "@linkview/db";
import { and, asc, count, eq, isNull } from "drizzle-orm";

export interface BioPageListItem {
  id: string;
  slug: string;
  title: string | null;
  isActive: boolean;
  linkCount: number;
}

export async function listBioPages(
  workspaceId: string,
): Promise<BioPageListItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: bioPages.id,
      slug: bioPages.slug,
      title: bioPages.title,
      isActive: bioPages.isActive,
      linkCount: count(bioPageLinks.id),
    })
    .from(bioPages)
    .leftJoin(bioPageLinks, eq(bioPageLinks.bioPageId, bioPages.id))
    .where(
      and(eq(bioPages.workspaceId, workspaceId), isNull(bioPages.deletedAt)),
    )
    .groupBy(bioPages.id)
    .orderBy(asc(bioPages.createdAt));
  return rows;
}

export interface BioLink {
  id: string;
  label: string;
  url: string;
  position: number;
  isActive: boolean;
}

export interface BioPageDetail {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  theme: string;
  isActive: boolean;
  links: BioLink[];
}

export async function getBioPage(
  workspaceId: string,
  id: string,
): Promise<BioPageDetail | null> {
  const db = getDb();
  const [page] = await db
    .select({
      id: bioPages.id,
      slug: bioPages.slug,
      title: bioPages.title,
      description: bioPages.description,
      avatarUrl: bioPages.avatarUrl,
      theme: bioPages.theme,
      isActive: bioPages.isActive,
    })
    .from(bioPages)
    .where(
      and(
        eq(bioPages.id, id),
        eq(bioPages.workspaceId, workspaceId),
        isNull(bioPages.deletedAt),
      ),
    )
    .limit(1);
  if (!page) return null;

  const links = await db
    .select({
      id: bioPageLinks.id,
      label: bioPageLinks.label,
      url: bioPageLinks.url,
      position: bioPageLinks.position,
      isActive: bioPageLinks.isActive,
    })
    .from(bioPageLinks)
    .where(eq(bioPageLinks.bioPageId, id))
    .orderBy(asc(bioPageLinks.position));

  return { ...page, links };
}

export interface PublicBioLink {
  label: string;
  url: string;
}

export interface PublicBioPage {
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  theme: string;
  links: PublicBioLink[];
}

/** Active page + active links for public rendering, or null. */
export async function getPublicBioPage(
  slug: string,
): Promise<PublicBioPage | null> {
  const db = getDb();
  const [page] = await db
    .select({
      id: bioPages.id,
      title: bioPages.title,
      description: bioPages.description,
      avatarUrl: bioPages.avatarUrl,
      theme: bioPages.theme,
    })
    .from(bioPages)
    .where(
      and(
        eq(bioPages.slug, slug),
        eq(bioPages.isActive, true),
        isNull(bioPages.deletedAt),
      ),
    )
    .limit(1);
  if (!page) return null;

  const links = await db
    .select({ label: bioPageLinks.label, url: bioPageLinks.url })
    .from(bioPageLinks)
    .where(
      and(eq(bioPageLinks.bioPageId, page.id), eq(bioPageLinks.isActive, true)),
    )
    .orderBy(asc(bioPageLinks.position));

  return {
    title: page.title,
    description: page.description,
    avatarUrl: page.avatarUrl,
    theme: page.theme,
    links,
  };
}
