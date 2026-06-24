import type { PlanKey } from "./constants";

export interface PlanLimits {
  key: PlanKey;
  name: string;
  priceCents: number;
  currency: "BRL";
  billingCycle: "monthly";
  maxLinks: number;
  maxClicksPerMonth: number;
  maxWorkspaces: number;
  maxMembers: number;
  customDomainsEnabled: boolean;
  passwordLinksEnabled: boolean;
  expirationEnabled: boolean;
  qrCodesEnabled: boolean;
  bioPagesEnabled: boolean;
  /** Custom redirect page layouts (own logo, background, colors, blur). Free
   * plans are locked to the branded linkview interstitial. */
  customSplashEnabled: boolean;
  analyticsRetentionDays: number;
  csvExportEnabled: boolean;
}

/** Plan catalog mirrors ARCHITECTURE.md section 12. Postgres `plans` table is
 * the source of truth at runtime; this is the seed / fallback definition. */
export const PLANS: Record<PlanKey, PlanLimits> = {
  free: {
    key: "free",
    name: "Free",
    priceCents: 0,
    currency: "BRL",
    billingCycle: "monthly",
    maxLinks: 10,
    maxClicksPerMonth: 5_000,
    maxWorkspaces: 1,
    maxMembers: 1,
    customDomainsEnabled: false,
    passwordLinksEnabled: false,
    expirationEnabled: false,
    qrCodesEnabled: true,
    bioPagesEnabled: false,
    customSplashEnabled: false,
    analyticsRetentionDays: 7,
    csvExportEnabled: false,
  },
  trial: {
    // 7-day free trial: mirrors Pro so trial users get the full premium
    // experience. priceCents 0 — granted via startTrial(), never billed. When
    // the trial ends without a paid subscription the workspace drops to free.
    key: "trial",
    name: "Teste Pro",
    priceCents: 0,
    currency: "BRL",
    billingCycle: "monthly",
    maxLinks: 500,
    maxClicksPerMonth: 250_000,
    maxWorkspaces: 1,
    maxMembers: 3,
    customDomainsEnabled: false,
    passwordLinksEnabled: true,
    expirationEnabled: true,
    qrCodesEnabled: true,
    bioPagesEnabled: true,
    customSplashEnabled: true,
    analyticsRetentionDays: 365,
    csvExportEnabled: true,
  },
  starter: {
    key: "starter",
    name: "Starter",
    priceCents: 990,
    currency: "BRL",
    billingCycle: "monthly",
    maxLinks: 100,
    maxClicksPerMonth: 50_000,
    maxWorkspaces: 1,
    maxMembers: 1,
    customDomainsEnabled: false,
    passwordLinksEnabled: false,
    expirationEnabled: true,
    qrCodesEnabled: true,
    bioPagesEnabled: false,
    customSplashEnabled: true,
    analyticsRetentionDays: 30,
    csvExportEnabled: false,
  },
  pro: {
    key: "pro",
    name: "Pro",
    priceCents: 2490,
    currency: "BRL",
    billingCycle: "monthly",
    maxLinks: 500,
    maxClicksPerMonth: 250_000,
    maxWorkspaces: 1,
    maxMembers: 3,
    customDomainsEnabled: false,
    passwordLinksEnabled: true,
    expirationEnabled: true,
    qrCodesEnabled: true,
    bioPagesEnabled: true,
    customSplashEnabled: true,
    analyticsRetentionDays: 365,
    csvExportEnabled: true,
  },
  business: {
    key: "business",
    name: "Business",
    priceCents: 3990,
    currency: "BRL",
    billingCycle: "monthly",
    maxLinks: 5_000,
    maxClicksPerMonth: 2_000_000,
    maxWorkspaces: 3,
    maxMembers: 25,
    customDomainsEnabled: true,
    passwordLinksEnabled: true,
    expirationEnabled: true,
    qrCodesEnabled: true,
    bioPagesEnabled: true,
    customSplashEnabled: true,
    analyticsRetentionDays: 365,
    csvExportEnabled: true,
  },
};

export function getPlan(key: PlanKey): PlanLimits {
  return PLANS[key];
}

/** Billing cadence the customer pays on. `monthly` is every plan's base; some
 * plans also offer a discounted `yearly` cycle (see {@link ANNUAL_PRICE_CENTS}). */
export type BillingCycle = "monthly" | "yearly";

/**
 * Yearly price (cents charged once per year) for plans that offer an annual
 * cycle. A plan absent from this map is monthly-only. Pro's annual is priced
 * below 12× the monthly so the customer saves by paying upfront.
 */
export const ANNUAL_PRICE_CENTS: Partial<Record<PlanKey, number>> = {
  pro: 24_900,
};

/** Whether a plan can be bought on a yearly cycle. */
export function hasAnnualPlan(key: PlanKey): boolean {
  return ANNUAL_PRICE_CENTS[key] != null;
}

/** Amount charged per renewal for a plan on the given cycle, in cents. */
export function getCyclePriceCents(key: PlanKey, cycle: BillingCycle): number {
  if (cycle === "yearly") {
    const yearly = ANNUAL_PRICE_CENTS[key];
    if (yearly == null) {
      throw new Error(`Plano ${key} não tem ciclo anual.`);
    }
    return yearly;
  }
  return getPlan(key).priceCents;
}

export interface AnnualSavings {
  /** Yearly price, cents. */
  yearlyCents: number;
  /** What 12 monthly charges would cost, cents. */
  monthlyTimesTwelveCents: number;
  /** Cents saved per year by paying annually. */
  savingsCents: number;
  /** Effective monthly cost on the annual plan, cents (yearly / 12, rounded). */
  monthlyEquivalentCents: number;
  /** Discount vs. paying monthly, whole percent. */
  percentOff: number;
}

/**
 * Savings of a plan's annual cycle vs. paying month to month. All figures are
 * derived from the two prices so the marketing copy can never drift from what
 * we actually charge. Throws if the plan has no annual cycle.
 */
export function getAnnualSavings(key: PlanKey): AnnualSavings {
  const monthly = getPlan(key).priceCents;
  const yearly = getCyclePriceCents(key, "yearly");
  const monthlyTimesTwelveCents = monthly * 12;
  const savingsCents = monthlyTimesTwelveCents - yearly;
  return {
    yearlyCents: yearly,
    monthlyTimesTwelveCents,
    savingsCents,
    monthlyEquivalentCents: Math.round(yearly / 12),
    percentOff: Math.round((savingsCents / monthlyTimesTwelveCents) * 100),
  };
}
