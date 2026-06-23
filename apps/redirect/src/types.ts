export interface Bindings {
	LINKS_KV: KVNamespace;
	IP_HASH_SALT: string;
	CLICK_INGEST_URL?: string;
	CLICK_INGEST_TOKEN?: string;
	/** Web endpoint that verifies a link password against Postgres (§14.5). */
	UNLOCK_VERIFY_URL?: string;
	/** Secret used to sign the password-unlock cookie (HMAC-SHA256). */
	UNLOCK_SECRET?: string;
	SENTRY_DSN?: string;
}
