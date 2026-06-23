/** Slugs that cannot be used for short links (collide with app routes). */
export const RESERVED_SLUGS = new Set<string>([
  "login",
  "register",
  "dashboard",
  "admin",
  "api",
  "pricing",
  "settings",
  "billing",
  "support",
  "help",
  "terms",
  "privacy",
  "termos",
  "privacidade",
  "app",
  "www",
  "static",
  "assets",
  "public",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 64;
/** Allowed slug characters: lowercase letters, digits, hyphen, underscore. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;

export const PLAN_KEYS = [
  "free",
  "trial",
  "starter",
  "pro",
  "business",
] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

/** Length of the free trial in days. The trial unlocks Pro-tier features. */
export const TRIAL_DURATION_DAYS = 7;
/**
 * Grace window (days) after a trial ends during which a non-converting
 * workspace's data is retained before it is soft-deleted (LGPD: data kept for
 * the documented retention period, then withdrawn from the product).
 */
export const TRIAL_RETENTION_DAYS = 30;

export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "expired",
  "pending",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const DOMAIN_TYPES = ["system", "custom"] as const;
export type DomainType = (typeof DOMAIN_TYPES)[number];

export const DOMAIN_STATUSES = [
  "pending",
  "active",
  "failed",
  "disabled",
] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];
