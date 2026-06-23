import { config } from "dotenv";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { plans, subscriptions, workspaces } from "./schema";

// One-off dev helper: promote the most recent workspace to an active Pro
// subscription so the dashboard gate opens without a real Asaas payment.
config({ path: "../../.env" });

async function main() {
  const db = getDb();

  const [ws] = await db
    .select()
    .from(workspaces)
    .orderBy(desc(workspaces.createdAt))
    .limit(1);
  if (!ws) throw new Error("No workspace found.");

  const [pro] = await db
    .select()
    .from(plans)
    .where(eq(plans.key, "pro"))
    .limit(1);
  if (!pro) throw new Error("Pro plan not seeded.");

  await db
    .update(workspaces)
    .set({ planKey: "pro" })
    .where(eq(workspaces.id, ws.id));

  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [existing] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, ws.id))
    .limit(1);

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        planId: pro.id,
        provider: "manual",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      workspaceId: ws.id,
      planId: pro.id,
      provider: "manual",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    });
  }

  console.log(`Unlocked Pro for workspace "${ws.name}" (${ws.slug}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
