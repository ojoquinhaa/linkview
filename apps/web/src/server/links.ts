"use server";
import { can } from "@linkview/auth/permissions";
import { getDb, links, pageLayouts } from "@linkview/db";
import {
  type CreateLinkInput,
  canonicalizeDestinationUrl,
  createLinkSchema,
  generateSlug,
  getPlan,
  type KvLinkRecord,
  type LinkSecurityInput,
  linkSecuritySchema,
  normalizeSlug,
  type PlanKey,
  resolveSplash,
  type SplashConfig,
  type UpdateLinkInput,
  updateLinkSchema,
  validateSlug,
} from "@linkview/shared";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { removeLinkFromKv, syncLinkToKv } from "@/lib/kv";
import { hashPassword } from "@/lib/password";
import { logAudit } from "./audit";
import { LOCKED_WRITE_MESSAGE, workspaceCanWrite } from "./billing/guard";
import { getSystemDomain } from "./domain";
import { requireSession } from "./session";
import { getActiveWorkspace } from "./workspace";

export interface CreateLinkResult {
  ok: boolean;
  error?: string;
  link?: { id: string; slug: string; shortUrl: string };
}

/** Security controls mirrored to the redirect Worker via KV. */
interface KvSecurity {
  blockBots?: boolean;
  allowedCountries?: string[] | null;
  blockedCountries?: string[] | null;
  rateLimitPerMinute?: number | null;
}

/** Build the operational KV record (§16.1) from authoritative Postgres state. */
function toKvRecord(args: {
  linkId: string;
  workspaceId: string;
  destinationUrl: string;
  active: boolean;
  expiresAt: Date | null;
  passwordProtected: boolean;
  security?: KvSecurity;
  splash?: SplashConfig | null;
}): KvLinkRecord {
  const s = args.security ?? {};
  return {
    linkId: args.linkId,
    workspaceId: args.workspaceId,
    destinationUrl: args.destinationUrl,
    active: args.active,
    expiresAt: args.expiresAt ? args.expiresAt.toISOString() : null,
    passwordProtected: args.passwordProtected,
    blockBots: s.blockBots ?? false,
    allowedCountries: s.allowedCountries ?? [],
    blockedCountries: s.blockedCountries ?? [],
    rateLimitPerMinute: s.rateLimitPerMinute ?? null,
    splash: args.splash ?? null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Resolve the interstitial config for a link's KV record. Free plans always get
 * the forced branded splash; paid plans get their assigned layout (or null for
 * a direct redirect). Loads the layout row only when one is assigned and the
 * plan can use it.
 */
async function resolveSplashForLink(
  planKey: PlanKey,
  pageLayoutId: string | null,
): Promise<SplashConfig | null> {
  if (!pageLayoutId || !getPlan(planKey).customSplashEnabled) {
    return resolveSplash(planKey, null);
  }
  const db = getDb();
  const [layout] = await db
    .select({
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
    })
    .from(pageLayouts)
    .where(and(eq(pageLayouts.id, pageLayoutId), isNull(pageLayouts.deletedAt)))
    .limit(1);
  return resolveSplash(planKey, layout ? toSplashLayout(layout) : null);
}

/** Narrow the loosely-typed text columns to the splash layout union types. */
function toSplashLayout(row: {
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
}) {
  return {
    ...row,
    bgType: row.bgType === "image" ? ("image" as const) : ("color" as const),
    logoPosition:
      row.logoPosition === "top"
        ? ("top" as const)
        : row.logoPosition === "bottom"
          ? ("bottom" as const)
          : ("center" as const),
  };
}

/** Resolve a usable slug: validate a custom one, or generate a unique random. */
async function resolveSlug(
  custom: string | undefined,
  domainId: string,
): Promise<{ slug?: string; error?: string }> {
  const db = getDb();
  const exists = async (slug: string) => {
    const [row] = await db
      .select({ id: links.id })
      .from(links)
      .where(and(eq(links.domainId, domainId), eq(links.slug, slug)))
      .limit(1);
    return Boolean(row);
  };

  if (custom) {
    const slug = normalizeSlug(custom);
    const err = validateSlug(slug);
    if (err) return { error: `Slug inválido: ${err}` };
    if (await exists(slug)) return { error: "Slug já está em uso." };
    return { slug };
  }

  for (let i = 0; i < 5; i++) {
    const slug = generateSlug(7);
    if (!(await exists(slug))) return { slug };
  }
  return { error: "Não foi possível gerar um slug único." };
}

export async function createLinkAction(
  input: CreateLinkInput,
): Promise<CreateLinkResult> {
  const parsed = createLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;
  // Percent-encode any raw non-ASCII (e.g. emoji) so it survives the redirect
  // Location header and KV/DB round-trips intact.
  const destinationUrl = canonicalizeDestinationUrl(data.destinationUrl);

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.create")) {
    return { ok: false, error: "Sem permissão para criar links." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED_WRITE_MESSAGE };
  }

  const plan = getPlan((workspace.planKey as PlanKey) ?? "free");
  const db = getDb();

  const [{ value: activeCount }] = await db
    .select({ value: count() })
    .from(links)
    .where(
      and(
        eq(links.workspaceId, workspace.id),
        eq(links.isActive, true),
        isNull(links.deletedAt),
      ),
    );
  if (activeCount >= plan.maxLinks) {
    return {
      ok: false,
      error: `Limite do plano ${plan.name} atingido (${plan.maxLinks} links). Faça upgrade.`,
    };
  }

  if (data.password && !plan.passwordLinksEnabled) {
    return {
      ok: false,
      error: "Links com senha não disponíveis no seu plano.",
    };
  }
  if (data.expiresAt && !plan.expirationEnabled) {
    return {
      ok: false,
      error: "Expiração de link não disponível no seu plano.",
    };
  }

  const domain = await getSystemDomain();
  const { slug, error } = await resolveSlug(data.slug, domain.id);
  if (error || !slug) return { ok: false, error: error ?? "Slug inválido." };

  const passwordHash = data.password ? hashPassword(data.password) : null;

  const [created] = await db
    .insert(links)
    .values({
      workspaceId: workspace.id,
      createdByUserId: session.user.id,
      domainId: domain.id,
      campaignId: data.campaignId,
      slug,
      destinationUrl,
      title: data.title,
      description: data.description,
      expiresAt: data.expiresAt,
      passwordHash,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmTerm: data.utmTerm,
      utmContent: data.utmContent,
      tags: data.tags,
    })
    .returning({ id: links.id, slug: links.slug });

  if (!created) return { ok: false, error: "Falha ao criar link." };

  // Sync operational record to KV; Postgres remains source of truth (§16.1).
  const record = toKvRecord({
    linkId: created.id,
    workspaceId: workspace.id,
    destinationUrl,
    active: true,
    expiresAt: data.expiresAt ?? null,
    passwordProtected: Boolean(passwordHash),
    // New links have no layout yet; free plans still get the branded splash.
    splash: resolveSplash(plan.key, null),
  });
  try {
    await syncLinkToKv(domain.hostname, created.slug, record);
  } catch (err) {
    console.error("link.kv_sync_failed", err);
    // TODO: enqueue resync; do not fail the creation.
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.created",
    entityType: "link",
    entityId: created.id,
  });

  revalidatePath("/dashboard/links");

  return {
    ok: true,
    link: {
      id: created.id,
      slug: created.slug,
      shortUrl: `https://${domain.hostname}/${created.slug}`,
    },
  };
}

export interface MutateLinkResult {
  ok: boolean;
  error?: string;
  /** Resolved slug after the mutation (may differ if the slug was changed). */
  slug?: string;
}

/** Load a link the caller owns (same workspace, not soft-deleted). */
async function loadOwnedLink(id: string, workspaceId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: links.id,
      slug: links.slug,
      destinationUrl: links.destinationUrl,
      isActive: links.isActive,
      expiresAt: links.expiresAt,
      passwordHash: links.passwordHash,
      maxClicks: links.maxClicks,
      blockBots: links.blockBots,
      allowedCountries: links.allowedCountries,
      blockedCountries: links.blockedCountries,
      rateLimitPerMinute: links.rateLimitPerMinute,
      pageLayoutId: links.pageLayoutId,
    })
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

export async function updateLinkAction(
  id: string,
  input: UpdateLinkInput,
): Promise<MutateLinkResult> {
  const parsed = updateLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED_WRITE_MESSAGE };
  }

  const db = getDb();
  const existing = await loadOwnedLink(id, workspace.id);
  if (!existing) return { ok: false, error: "Link não encontrado." };

  const domain = await getSystemDomain();

  // Resolve a slug change, if any.
  let nextSlug = existing.slug;
  if (data.slug !== undefined) {
    const normalized = normalizeSlug(data.slug);
    if (normalized !== existing.slug) {
      const err = validateSlug(normalized);
      if (err) return { ok: false, error: `Slug inválido: ${err}` };
      const [clash] = await db
        .select({ id: links.id })
        .from(links)
        .where(
          and(
            eq(links.domainId, domain.id),
            eq(links.slug, normalized),
            ne(links.id, id),
          ),
        )
        .limit(1);
      if (clash) return { ok: false, error: "Slug já está em uso." };
      nextSlug = normalized;
    }
  }

  const nextDestination = canonicalizeDestinationUrl(
    data.destinationUrl ?? existing.destinationUrl,
  );
  const nextActive = data.isActive ?? existing.isActive;
  const nextExpires =
    data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt;

  await db
    .update(links)
    .set({
      slug: nextSlug,
      destinationUrl: nextDestination,
      isActive: nextActive,
      expiresAt: nextExpires,
      ...(data.title !== undefined ? { title: data.title || null } : {}),
      ...(data.description !== undefined
        ? { description: data.description || null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(links.id, id));

  const record = toKvRecord({
    linkId: id,
    workspaceId: workspace.id,
    destinationUrl: nextDestination,
    active: nextActive,
    expiresAt: nextExpires,
    passwordProtected: Boolean(existing.passwordHash),
    security: {
      blockBots: existing.blockBots,
      allowedCountries: existing.allowedCountries,
      blockedCountries: existing.blockedCountries,
      rateLimitPerMinute: existing.rateLimitPerMinute,
    },
    splash: await resolveSplashForLink(
      workspace.planKey as PlanKey,
      existing.pageLayoutId,
    ),
  });
  try {
    if (nextSlug !== existing.slug) {
      await removeLinkFromKv(domain.hostname, existing.slug);
    }
    await syncLinkToKv(domain.hostname, nextSlug, record);
  } catch (err) {
    console.error("link.kv_sync_failed", err);
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.updated",
    entityType: "link",
    entityId: id,
  });

  revalidatePath("/dashboard/links");
  revalidatePath(`/dashboard/links/${existing.slug}`);
  if (nextSlug !== existing.slug) {
    revalidatePath(`/dashboard/links/${nextSlug}`);
  }

  return { ok: true, slug: nextSlug };
}

export async function toggleLinkAction(
  id: string,
  isActive: boolean,
): Promise<MutateLinkResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED_WRITE_MESSAGE };
  }

  const db = getDb();
  const existing = await loadOwnedLink(id, workspace.id);
  if (!existing) return { ok: false, error: "Link não encontrado." };

  await db
    .update(links)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(links.id, id));

  const domain = await getSystemDomain();
  const record = toKvRecord({
    linkId: id,
    workspaceId: workspace.id,
    destinationUrl: existing.destinationUrl,
    active: isActive,
    expiresAt: existing.expiresAt,
    passwordProtected: Boolean(existing.passwordHash),
    security: {
      blockBots: existing.blockBots,
      allowedCountries: existing.allowedCountries,
      blockedCountries: existing.blockedCountries,
      rateLimitPerMinute: existing.rateLimitPerMinute,
    },
    splash: await resolveSplashForLink(
      workspace.planKey as PlanKey,
      existing.pageLayoutId,
    ),
  });
  try {
    await syncLinkToKv(domain.hostname, existing.slug, record);
  } catch (err) {
    console.error("link.kv_sync_failed", err);
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: isActive ? "link.activated" : "link.paused",
    entityType: "link",
    entityId: id,
  });

  revalidatePath("/dashboard/links");
  revalidatePath(`/dashboard/links/${existing.slug}`);
  return { ok: true, slug: existing.slug };
}

export async function deleteLinkAction(id: string): Promise<MutateLinkResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.delete")) {
    return { ok: false, error: "Sem permissão para excluir links." };
  }

  const db = getDb();
  const existing = await loadOwnedLink(id, workspace.id);
  if (!existing) return { ok: false, error: "Link não encontrado." };

  await db
    .update(links)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(links.id, id));

  const domain = await getSystemDomain();
  try {
    await removeLinkFromKv(domain.hostname, existing.slug);
  } catch (err) {
    console.error("link.kv_delete_failed", err);
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.deleted",
    entityType: "link",
    entityId: id,
  });

  revalidatePath("/dashboard/links");
  return { ok: true };
}

/** Update the security controls for a link (§14.5–14.7). */
export async function updateLinkSecurityAction(
  id: string,
  input: LinkSecurityInput,
): Promise<MutateLinkResult> {
  const parsed = linkSecuritySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }
  const data = parsed.data;

  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED_WRITE_MESSAGE };
  }

  const plan = getPlan((workspace.planKey as PlanKey) ?? "free");
  if (data.password && !plan.passwordLinksEnabled) {
    return {
      ok: false,
      error: "Links com senha não disponíveis no seu plano.",
    };
  }
  if (data.expiresAt && !plan.expirationEnabled) {
    return {
      ok: false,
      error: "Expiração de link não disponível no seu plano.",
    };
  }

  // Allow-list and deny-list must not name the same country (ambiguous policy).
  if (data.allowedCountries?.length && data.blockedCountries?.length) {
    const blocked = new Set(data.blockedCountries);
    if (data.allowedCountries.some((c) => blocked.has(c))) {
      return { ok: false, error: "Um país não pode estar nas duas listas." };
    }
  }

  const db = getDb();
  const existing = await loadOwnedLink(id, workspace.id);
  if (!existing) return { ok: false, error: "Link não encontrado." };

  // Password: undefined = keep, null = remove, value = set new hash (§14.5).
  let passwordHash = existing.passwordHash;
  if (data.password !== undefined) {
    passwordHash = data.password ? hashPassword(data.password) : null;
  }

  const nextActive = data.isActive ?? existing.isActive;
  const nextExpires =
    data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt;
  const nextMaxClicks =
    data.maxClicks !== undefined ? data.maxClicks : existing.maxClicks;
  const nextBlockBots = data.blockBots ?? existing.blockBots;
  const nextAllowed =
    data.allowedCountries !== undefined
      ? data.allowedCountries
      : existing.allowedCountries;
  const nextBlocked =
    data.blockedCountries !== undefined
      ? data.blockedCountries
      : existing.blockedCountries;
  const nextRate =
    data.rateLimitPerMinute !== undefined
      ? data.rateLimitPerMinute
      : existing.rateLimitPerMinute;

  await db
    .update(links)
    .set({
      passwordHash,
      isActive: nextActive,
      expiresAt: nextExpires,
      maxClicks: nextMaxClicks,
      blockBots: nextBlockBots,
      allowedCountries: nextAllowed,
      blockedCountries: nextBlocked,
      rateLimitPerMinute: nextRate,
      updatedAt: new Date(),
    })
    .where(eq(links.id, id));

  const domain = await getSystemDomain();
  const record = toKvRecord({
    linkId: id,
    workspaceId: workspace.id,
    destinationUrl: existing.destinationUrl,
    active: nextActive,
    expiresAt: nextExpires,
    passwordProtected: Boolean(passwordHash),
    security: {
      blockBots: nextBlockBots,
      allowedCountries: nextAllowed,
      blockedCountries: nextBlocked,
      rateLimitPerMinute: nextRate,
    },
    splash: await resolveSplashForLink(
      workspace.planKey as PlanKey,
      existing.pageLayoutId,
    ),
  });
  try {
    await syncLinkToKv(domain.hostname, existing.slug, record);
  } catch (err) {
    console.error("link.kv_sync_failed", err);
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.security_updated",
    entityType: "link",
    entityId: id,
  });

  revalidatePath(`/dashboard/links/${existing.slug}`);
  revalidatePath(`/dashboard/links/${existing.slug}/seguranca`);
  revalidatePath("/dashboard/links");
  return { ok: true, slug: existing.slug };
}

/**
 * Reset a link's click counters and reactivate it. Used to lift a reached
 * click cap (§14.7). Click history rows are kept; only the denormalized
 * totals that the cap reads are zeroed.
 */
export async function resetLinkClicksAction(
  id: string,
): Promise<MutateLinkResult> {
  const session = await requireSession();
  const workspace = await getActiveWorkspace(session.user.id);
  if (!workspace) return { ok: false, error: "Nenhum workspace ativo." };
  if (!can(workspace.role, "link.edit")) {
    return { ok: false, error: "Sem permissão para editar links." };
  }
  if (!(await workspaceCanWrite(workspace.id))) {
    return { ok: false, error: LOCKED_WRITE_MESSAGE };
  }

  const db = getDb();
  const existing = await loadOwnedLink(id, workspace.id);
  if (!existing) return { ok: false, error: "Link não encontrado." };

  await db
    .update(links)
    .set({
      totalClicks: 0,
      uniqueClicks: 0,
      isActive: true,
      lastClickedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(links.id, id));

  const domain = await getSystemDomain();
  const record = toKvRecord({
    linkId: id,
    workspaceId: workspace.id,
    destinationUrl: existing.destinationUrl,
    active: true,
    expiresAt: existing.expiresAt,
    passwordProtected: Boolean(existing.passwordHash),
    security: {
      blockBots: existing.blockBots,
      allowedCountries: existing.allowedCountries,
      blockedCountries: existing.blockedCountries,
      rateLimitPerMinute: existing.rateLimitPerMinute,
    },
    splash: await resolveSplashForLink(
      workspace.planKey as PlanKey,
      existing.pageLayoutId,
    ),
  });
  try {
    await syncLinkToKv(domain.hostname, existing.slug, record);
  } catch (err) {
    console.error("link.kv_sync_failed", err);
  }

  await logAudit({
    workspaceId: workspace.id,
    userId: session.user.id,
    action: "link.clicks_reset",
    entityType: "link",
    entityId: id,
  });

  revalidatePath(`/dashboard/links/${existing.slug}`);
  revalidatePath(`/dashboard/links/${existing.slug}/seguranca`);
  revalidatePath("/dashboard/links");
  return { ok: true, slug: existing.slug };
}
