/**
 * Consent + legal-document versioning for LGPD compliance.
 *
 * Each acceptance is recorded against the document version in force at the
 * moment, so we can prove *what* a user agreed to. Bump the version date
 * whenever the Terms or Privacy Policy text changes materially; existing rows
 * keep their old version, new acceptances get the new one.
 */

/** Version (ISO date) of the Terms of Use currently published. */
export const TERMS_VERSION = "2026-06-18";

/** Version (ISO date) of the Privacy Policy currently published. */
export const PRIVACY_VERSION = "2026-06-18";

/** The kinds of consent we record, each on its own legal basis (LGPD art. 7). */
export const CONSENT_TYPES = ["terms", "privacy", "marketing"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Person type for fiscal identification. */
export const PERSON_TYPES = ["pf", "pj"] as const;
export type PersonTypeKey = (typeof PERSON_TYPES)[number];

/** Lifecycle status of a user account (supports LGPD right to erasure). */
export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
