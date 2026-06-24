"use client";

import { useMemo, useState } from "react";
import { toUf, UF_NAMES } from "@/lib/br-states";
import brGeo from "./br-geo.json";
import { GeoChoropleth } from "./geo-choropleth";
import worldGeo from "./world-geo.json";

export interface CountryDatum {
  iso: string;
  total: number;
}
export interface RegionDatum {
  /** Whatever the edge stored: a UF sigla ("SP") or a full state name. */
  region: string;
  total: number;
}

const ptCountry = (() => {
  try {
    const dn = new Intl.DisplayNames(["pt-BR"], { type: "region" });
    return (iso: string) => {
      try {
        return dn.of(iso.toUpperCase()) ?? iso;
      } catch {
        return iso;
      }
    };
  } catch {
    return (iso: string) => iso;
  }
})();

type View = "mundo" | "brasil";

/**
 * Access map with a Mundo / Brasil toggle. The world view is a country
 * choropleth that auto-frames the dominant country; the Brazil view is a
 * state choropleth. Defaults to whichever tells the clearer story: Brazil when
 * it carries most of the located clicks.
 */
export function AccessMap({
  countries,
  regions,
  locatedTotal,
  height = 360,
}: {
  countries: CountryDatum[];
  regions: RegionDatum[];
  locatedTotal: number;
  height?: number;
}) {
  // Fold edge region strings into canonical UFs and sum collisions.
  const brData = useMemo(() => {
    const acc = new Map<string, number>();
    for (const r of regions) {
      const uf = toUf(r.region);
      if (!uf) continue;
      acc.set(uf, (acc.get(uf) ?? 0) + r.total);
    }
    return [...acc].map(([key, total]) => ({ key, total }));
  }, [regions]);

  const brTotal = brData.reduce((s, d) => s + d.total, 0);
  const hasBr = brData.length > 0;

  const topCountry = useMemo(
    () => [...countries].sort((a, b) => b.total - a.total)[0],
    [countries],
  );
  const brDominant =
    locatedTotal > 0 && brTotal / locatedTotal >= 0.55 && hasBr;

  const [view, setView] = useState<View>(brDominant ? "brasil" : "mundo");
  const active = view === "brasil" && hasBr ? "brasil" : "mundo";

  return (
    <div>
      {hasBr && (
        <fieldset
          aria-label="Alcance do mapa"
          className="mb-3 inline-flex min-w-0 rounded-full border border-line bg-paper p-0.5 text-[0.8rem] font-medium"
        >
          {(["mundo", "brasil"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={active === v}
              className={`rounded-full px-3 py-1 transition-colors ${
                active === v
                  ? "bg-accent text-accent-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              {v === "mundo" ? "Mundo" : "Brasil"}
            </button>
          ))}
        </fieldset>
      )}

      {active === "brasil" ? (
        <GeoChoropleth
          mapName="brazil"
          geo={brGeo}
          data={brData}
          total={brTotal}
          baseZoom={1.1}
          height={height}
          label={(uf) => UF_NAMES[uf] ?? uf}
        />
      ) : (
        <GeoChoropleth
          mapName="world"
          geo={worldGeo}
          data={countries.map((c) => ({
            key: c.iso.toUpperCase(),
            total: c.total,
          }))}
          total={locatedTotal}
          height={height}
          focusKey={
            topCountry && topCountry.total / Math.max(1, locatedTotal) >= 0.55
              ? topCountry.iso.toUpperCase()
              : null
          }
          label={ptCountry}
        />
      )}
    </div>
  );
}
