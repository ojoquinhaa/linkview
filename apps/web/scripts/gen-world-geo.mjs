// Regenerates the slim world GeoJSON used by the overview map.
//
//   curl -sL -o ne.geojson \
//     https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
//   node scripts/gen-world-geo.mjs ne.geojson
//
// Source: Natural Earth 1:110m admin-0 countries (public domain).
// We keep only geometry plus a single `name` property set to the ISO 3166-1
// alpha-2 code (ISO_A2_EH fixes France/Norway/etc.), and round coordinates to
// 2 decimals (~1 km), which is ample for a country-level choropleth and cuts
// the payload by roughly 4x. Display names are derived at runtime via
// Intl.DisplayNames, so no country-name strings are bundled.
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/gen-world-geo.mjs <ne_110m.geojson>");
  process.exit(1);
}

const round = (n) => Math.round(n * 100) / 100;
const roundCoords = (c) =>
  typeof c[0] === "number" ? [round(c[0]), round(c[1])] : c.map(roundCoords);

const src = JSON.parse(readFileSync(input, "utf8"));
const features = [];
for (const f of src.features) {
  const iso = f.properties.ISO_A2_EH ?? f.properties.ISO_A2;
  if (!iso || iso === "-99" || iso === "AQ") continue; // skip unknown + Antarctica
  features.push({
    type: "Feature",
    properties: { name: iso },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates),
    },
  });
}

const out = { type: "FeatureCollection", features };
const dest = new URL(
  "../src/components/dashboard/charts/world-geo.json",
  import.meta.url,
);
writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${features.length} countries to ${dest.pathname}`);
