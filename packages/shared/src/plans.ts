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
   * plans are locked to the branded urlsimples interstitial. */
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
    priceCents: 1990,
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
