import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { user } from "./schema";

// Promote a user to the platform `admin` role so they can reach the internal
// /admin console. Usage: pnpm --filter @linkview/db db:make-admin <email>
config({ path: "../../.env" });

async function main() {
	const email = process.argv[2]?.trim().toLowerCase();
	if (!email) {
		throw new Error("Usage: db:make-admin <email>");
	}

	const db = getDb();
	const [row] = await db
		.update(user)
		.set({ role: "admin" })
		.where(eq(user.email, email))
		.returning({ id: user.id, email: user.email, role: user.role });

	if (!row) {
		throw new Error(`No user found with email "${email}".`);
	}
	console.log(`Promoted ${row.email} to platform role "${row.role}".`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
