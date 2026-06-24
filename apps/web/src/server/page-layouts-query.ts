import "server-only";
import { getDb, links, pageLayouts } from "@linkview/db";
import type { LogoPosition, SplashBgType } from "@linkview/shared";
import { and, count, eq, isNull } from "drizzle-orm";

export interface PageLayoutRow {
  id: string;
  name: string;
  logoUrl: string | null;
  bgType: SplashBgType;
  bgColor: string;
  bgImageUrl: string | null;
  blur: number;
  logoPosition: LogoPosition;
  accentColor: string;
  textColor: string;
  countdownSeconds: number;
  showBranding: boolean;
  updatedAt: Date;
}

export interface PageLayoutListItem extends PageLayoutRow {
  /** Number of links currently using this layout. */
  linkCount: number;
}

function narrow(row: {
  id: string;
  name: string;
  logoUrl: string | null;
  bgType: string;
  bgColor: string;
  bgImageUrl: string | null;
  blur: number;
  logoPosition: string;
  accentColor: string;
  textColor: string;
  countdownSeconds: number;
  showBranding: boolean;
  updatedAt: Date;
}): PageLayoutRow {
  return {
    ...row,
    bgType: row.bgType === "image" ? "image" : "color",
    logoPosition:
      row.logoPosition === "top"
        ? "top"
        : row.logoPosition === "bottom"
          ? "bottom"
          : "center",
  };
}

const SELECT = {
  id: pageLayouts.id,
  name: pageLayouts.name,
  logoUrl: pageLayouts.logoUrl,
  bgType: pageLayouts.bgType,
  bgColor: pageLayouts.bgColor,
  bgImageUrl: pageLayouts.bgImageUrl,
  blur: pageLayouts.blur,
  logoPosition: pageLayouts.logoPosition,
  accentColor: pageLayouts.accentColor,
  textColor: pageLayouts.textColor,
  countdownSeconds: pageLayouts.countdownSeconds,
  showBranding: pageLayouts.showBranding,
  updatedAt: pageLayouts.updatedAt,
} as const;

/** All redirect-page layouts for a workspace, newest first, with usage counts. */
export async function listPageLayouts(
  workspaceId: string,
): Promise<PageLayoutListItem[]> {
  const db = getDb();
  const rows = await db
    .select(SELECT)
    .from(pageLayouts)
    .where(
      and(
        eq(pageLayouts.workspaceId, workspaceId),
        isNull(pageLayouts.deletedAt),
      ),
    )
    .orderBy(pageLayouts.createdAt);

  const counts = await db
    .select({ layoutId: links.pageLayoutId, total: count() })
    .from(links)
    .where(and(eq(links.workspaceId, workspaceId), isNull(links.deletedAt)))
    .groupBy(links.pageLayoutId);
  const byLayout = new Map(counts.map((c) => [c.layoutId, Number(c.total)]));

  return rows.map((r) => ({
    ...narrow(r),
    linkCount: byLayout.get(r.id) ?? 0,
  }));
}

/** A single layout the workspace owns. Null when missing or deleted. */
export async function getPageLayout(
  workspaceId: string,
  id: string,
): Promise<PageLayoutRow | null> {
  const db = getDb();
  const [row] = await db
    .select(SELECT)
    .from(pageLayouts)
    .where(
      and(
        eq(pageLayouts.id, id),
        eq(pageLayouts.workspaceId, workspaceId),
        isNull(pageLayouts.deletedAt),
      ),
    )
    .limit(1);
  return row ? narrow(row) : null;
}
