import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { clicks, getDb, links } from "@linkview/db";
import { config } from "dotenv";
import { eq } from "drizzle-orm";

// Load monorepo-root .env (script runs from apps/web).
config({ path: resolve(process.cwd(), "../../.env") });

const SLUG = process.argv[2] ?? "2y9b999";
const COUNT = Number(process.argv[3] ?? 260);

// Weighted pickers ----------------------------------------------------------
type W<T> = [T, number];
const pick = <T>(rows: W<T>[]): T => {
  const total = rows.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of rows) {
    r -= w;
    if (r <= 0) return v;
  }
  return rows[rows.length - 1][0];
};

// Brazil dominates (~80%), with a long tail of other countries so the world
// map still shows reach. region is the UF sigla so the state map can match it.
const BR_STATES: W<[string, string]>[] = [
  [["SP", "São Paulo"], 26],
  [["RJ", "Rio de Janeiro"], 13],
  [["MG", "Belo Horizonte"], 11],
  [["RS", "Porto Alegre"], 7],
  [["PR", "Curitiba"], 7],
  [["BA", "Salvador"], 6],
  [["SC", "Florianópolis"], 5],
  [["PE", "Recife"], 5],
  [["CE", "Fortaleza"], 5],
  [["GO", "Goiânia"], 4],
  [["DF", "Brasília"], 4],
  [["ES", "Vitória"], 3],
  [["PA", "Belém"], 3],
  [["MT", "Cuiabá"], 2],
  [["AM", "Manaus"], 2],
  [["MA", "São Luís"], 2],
  [["RN", "Natal"], 2],
  [["PB", "João Pessoa"], 2],
];

const OTHER_COUNTRIES: W<[string, string]>[] = [
  [["US", "New York"], 5],
  [["PT", "Lisboa"], 4],
  [["AR", "Buenos Aires"], 3],
  [["AO", "Luanda"], 2],
  [["MZ", "Maputo"], 1],
  [["CL", "Santiago"], 1],
  [["ES", "Madrid"], 1],
  [["DE", "Berlin"], 1],
];

const DEVICES: W<string>[] = [
  ["mobile", 70],
  ["desktop", 24],
  ["tablet", 6],
];
const SOURCES: W<string | null>[] = [
  ["instagram", 28],
  ["whatsapp", 24],
  ["bio", 12],
  ["facebook", 8],
  ["tiktok", 8],
  ["youtube", 5],
  ["email", 4],
  [null, 11], // direct / untagged
];
const BROWSERS: W<string>[] = [
  ["Chrome", 55],
  ["Safari", 28],
  ["Edge", 8],
  ["Firefox", 5],
  ["Samsung Internet", 4],
];
const osFor = (device: string) =>
  device === "desktop"
    ? pick<string>([
        ["Windows", 60],
        ["macOS", 30],
        ["Linux", 10],
      ])
    : pick<string>([
        ["Android", 68],
        ["iOS", 32],
      ]);

const DAY_MS = 86_400_000;

async function main() {
  const db = getDb();
  const [link] = await db
    .select({ id: links.id, workspaceId: links.workspaceId })
    .from(links)
    .where(eq(links.slug, SLUG))
    .limit(1);
  if (!link) throw new Error(`Link com slug "${SLUG}" não encontrado.`);

  // A pool of visitors so unique < total (repeat visits look realistic).
  const visitors = Array.from({ length: Math.ceil(COUNT * 0.68) }, () =>
    randomUUID(),
  );
  const visitorIps = new Set<string>();

  const rows = Array.from({ length: COUNT }, () => {
    const isBr = Math.random() < 0.8;
    const [code, place] = isBr
      ? pick(BR_STATES)
      : (() => {
          const [c, city] = pick(OTHER_COUNTRIES);
          return [c, city] as [string, string];
        })();
    const country = isBr ? "BR" : code;
    const region = isBr ? code : null;
    const city = place;
    const device = pick(DEVICES);
    const ipHash = visitors[Math.floor(Math.random() * visitors.length)];
    visitorIps.add(ipHash);
    // Skew recent: square the random so more clicks land near today.
    const ageDays = Math.floor(Math.random() ** 2 * 18);
    const occurredAt = new Date(
      Date.now() - ageDays * DAY_MS - Math.floor(Math.random() * DAY_MS),
    );
    return {
      linkId: link.id,
      workspaceId: link.workspaceId,
      occurredAt,
      ipHash,
      referer: null,
      country,
      region,
      city,
      device,
      browser: pick(BROWSERS),
      os: osFor(device),
      bot: false,
      source: pick(SOURCES),
      medium: null,
      campaign: null,
    };
  });

  await db.insert(clicks).values(rows);

  const lastClickedAt = rows.reduce(
    (max, r) => (r.occurredAt > max ? r.occurredAt : max),
    rows[0].occurredAt,
  );
  await db
    .update(links)
    .set({
      totalClicks: COUNT,
      uniqueClicks: visitorIps.size,
      lastClickedAt,
    })
    .where(eq(links.id, link.id));

  console.log(
    `Inseridos ${COUNT} cliques em "${SLUG}" (${visitorIps.size} visitantes, ~80% BR por estado).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
