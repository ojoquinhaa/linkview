import { PLANS } from "@linkview/shared";
import { config } from "dotenv";
import { getDb } from "./client";
import { domains, plans } from "./schema";

config({ path: "../../.env" });

/** Idempotent seed: plan catalog + default system domain.
 * Run with: pnpm --filter @linkview/db exec tsx src/seed.ts */
async function main() {
  const db = getDb();
  const systemHostname = (process.env.SYSTEM_DOMAIN ?? "lnkv.com.br").trim();

  for (const plan of Object.values(PLANS)) {
    await db
      .insert(plans)
      .values({
        key: plan.key,
        name: plan.name,
        priceCents: plan.priceCents,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        maxLinks: plan.maxLinks,
        maxClicksPerMonth: plan.maxClicksPerMonth,
        maxWorkspaces: plan.maxWorkspaces,
        maxMembers: plan.maxMembers,
        customDomainsEnabled: plan.customDomainsEnabled,
        passwordLinksEnabled: plan.passwordLinksEnabled,
        expirationEnabled: plan.expirationEnabled,
        qrCodesEnabled: plan.qrCodesEnabled,
        bioPagesEnabled: plan.bioPagesEnabled,
        analyticsRetentionDays: plan.analyticsRetentionDays,
      })
      .onConflictDoNothing({ target: plans.key });
  }

  await db
    .insert(domains)
    .values({
      hostname: systemHostname,
      type: "system",
      status: "active",
      verifiedAt: new Date(),
    })
    .onConflictDoNothing({ target: domains.hostname });

  console.log(`Seed complete. Plans + system domain (${systemHostname}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
