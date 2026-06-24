// Regenerates the slim Brazil-states GeoJSON used by the overview map drill-in.
//
//   curl -sL -o br.geojson \
//     https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson
//   node scripts/gen-br-geo.mjs br.geojson
//
// Source: codeforamerica click_that_hood (public domain). We keep only geometry
// plus `name` set to the UF sigla (SP, RJ, ...) so click `region` data keyed by
// UF matches a state directly. Coordinates are rounded to 1 decimal (~11 km) and
// consecutive duplicates dropped, which is ample for a state choropleth.
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/gen-br-geo.mjs <brazil-states.geojson>");
  process.exit(1);
}

const round = (n) => Math.round(n * 10) / 10;
// Round a coordinate tree; on the innermost ring (array of [x,y] points) also
// drop points that collapse onto their predecessor after rounding.
const roundCoords = (c) => {
  if (typeof c[0] === "number") return [round(c[0]), round(c[1])];
  if (Array.isArray(c[0]) && typeof c[0][0] === "number") {
    const out = [];
    let prev = null;
    for (const p of c) {
      const r = [round(p[0]), round(p[1])];
      if (!prev || r[0] !== prev[0] || r[1] !== prev[1]) out.push(r);
      prev = r;
    }
    return out.length >= 4 ? out : c.map((p) => [round(p[0]), round(p[1])]);
  }
  return c.map(roundCoords);
};

const src = JSON.parse(readFileSync(input, "utf8"));
const features = src.features.map((f) => ({
  type: "Feature",
  properties: { name: f.properties.sigla },
  geometry: {
    type: f.geometry.type,
    coordinates: roundCoords(f.geometry.coordinates),
  },
}));

const dest = new URL(
  "../src/components/dashboard/charts/br-geo.json",
  import.meta.url,
);
writeFileSync(dest, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`wrote ${features.length} states to ${dest.pathname}`);
