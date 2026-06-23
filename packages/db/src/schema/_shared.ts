import { pgEnum, timestamp } from "drizzle-orm/pg-core";

/** Reusable created/updated timestamp columns (UTC, with timezone). */
export const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
};

export const softDelete = {
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const workspaceRoleEnum = pgEnum("workspace_role", [
	"owner",
	"admin",
	"member",
	"viewer",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
	"trialing",
	"active",
	"past_due",
	"unpaid",
	"canceled",
	"expired",
	"pending",
]);

export const domainTypeEnum = pgEnum("domain_type", ["system", "custom"]);

export const domainStatusEnum = pgEnum("domain_status", [
	"pending",
	"active",
	"failed",
	"disabled",
]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);

export const qrFormatEnum = pgEnum("qr_format", ["png", "svg"]);

/** Fiscal person type for a customer (física / jurídica). */
export const personTypeEnum = pgEnum("person_type", ["pf", "pj"]);

/** Kinds of consent recorded for LGPD, each on its own legal basis. */
export const consentTypeEnum = pgEnum("consent_type", [
	"terms",
	"privacy",
	"marketing",
]);

/** Account lifecycle status (supports LGPD right to erasure). */
export const userStatusEnum = pgEnum("user_status", [
	"active",
	"suspended",
	"deleted",
]);

/**
 * Platform-wide role, distinct from the workspace-scoped {@link workspaceRoleEnum}.
 * `admin` unlocks the internal `/admin` console (platform analytics + tenant
 * management); everyone else is a regular `user`.
 */
export const platformRoleEnum = pgEnum("platform_role", ["user", "admin"]);
