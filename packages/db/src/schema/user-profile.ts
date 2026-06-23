import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { consentTypeEnum, personTypeEnum, timestamps } from "./_shared";

/**
 * Fiscal + contact profile for a user, captured at registration. Kept in a
 * separate 1:1 table so the Better Auth `user` row stays lean and PII fields
 * live together. `document` stores digits only (CPF or CNPJ per `personType`),
 * validated by check-digit before insert. `signupIp` is retained as evidence of
 * the moment of consent (LGPD).
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    personType: personTypeEnum("person_type").notNull(),
    /** CPF (11) or CNPJ (14), digits only. */
    document: text("document").notNull(),
    phone: text("phone").notNull(),
    zip: text("zip").notNull(),
    street: text("street").notNull(),
    number: text("number").notNull(),
    complement: text("complement"),
    district: text("district").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    /** IP captured at sign-up, evidence for the consent record. */
    signupIp: text("signup_ip"),
    ...timestamps,
  },
  (t) => [index("user_profiles_document_idx").on(t.document)],
);

/**
 * Append-only consent ledger (LGPD art. 7/8). One row per acceptance event,
 * never updated or deleted, so we can prove *what version* of each document a
 * user agreed to and *when*. Withdrawing marketing consent is recorded as a new
 * row with `accepted = false`, preserving the history.
 */
export const userConsents = pgTable(
  "user_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: consentTypeEnum("type").notNull(),
    /** Version (ISO date) of the document accepted. */
    documentVersion: text("document_version").notNull(),
    accepted: boolean("accepted").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("user_consents_user_idx").on(t.userId)],
);
