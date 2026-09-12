#!/usr/bin/env node
/**
 * Resolve the free-text Profile.location values into coordinates for the
 * directory map.
 *
 * Profile.location is whatever a member typed ("Brooklyn, NY", "SF", "London,
 * UK"), so the map needs a lookup from that text to lat/lon. This builds that
 * lookup once and caches it in public/geo/locations.json, which is committed.
 * Nothing geocodes at request time: the site only ever reads the JSON, so the
 * map has no runtime dependency on an external service.
 *
 * Re-run whenever new locations appear. Resolved entries are skipped, so a
 * re-run only costs a request per genuinely new string.
 *
 *   node scripts/geocode-locations.js            # resolve anything new
 *   node scripts/geocode-locations.js --report   # list what is unresolved
 *
 * Geocoding is Nominatim (OpenStreetMap): free and keyless, but their usage
 * policy requires a real User-Agent and at most ~1 request/second, which
 * PACING_MS honours.
 */
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const OUT = path.join(__dirname, "..", "public", "geo", "locations.json");
const UA = "PBHA-Alumni-Directory-Map/1.0 (pbha-alumni on GitHub)";
const PACING_MS = 1200;

// One canonical key per place, so "Boston, MA", "boston, ma" and "Boston,MA "
// collapse onto a single dot. Must match CANON in public/index.html.
const CANON = {
  "cambridge": "cambridge, ma",
  "boston": "boston, ma",
  "sf": "san francisco, ca",
  "san francisco": "san francisco, ca",
  "nyc": "new york, ny",
  "new york city": "new york, ny",
  "dc": "washington, dc",
  "washington, d.c.": "washington, dc",
  "london": "london, uk",
};

const normalize = (v) =>
  CANON[String(v || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ")] ??
  String(v || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const geocode = async (query) => {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
  const hits = await res.json();
  if (!hits.length) return null;
  return {
    lat: Number(hits[0].lat),
    lon: Number(hits[0].lon),
    matched: hits[0].display_name,
  };
};

const main = async () => {
  const reportOnly = process.argv.includes("--report");
  const prisma = new PrismaClient();

  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

  const rows = await prisma.profile.findMany({
    where: { location: { not: null } },
    select: { location: true },
    distinct: ["location"],
  });
  await prisma.$disconnect();

  const wanted = [...new Set(rows.map((r) => normalize(r.location)).filter(Boolean))];
  const missing = wanted.filter((k) => !existing[k]);

  console.log(`${wanted.length} distinct locations, ${missing.length} unresolved`);
  if (!missing.length) return;
  if (reportOnly) {
    missing.forEach((m) => console.log("  " + m));
    return;
  }

  for (const key of missing) {
    try {
      const hit = await geocode(key);
      if (hit) {
        existing[key] = hit;
        console.log(`  ${key} -> ${hit.matched}`);
      } else {
        // Left out of the file rather than guessed at. An unresolved place
        // simply has no dot; --report lists them so a human can decide.
        console.log(`  ${key} -> no match`);
      }
    } catch (err) {
      console.error(`  ${key} -> ${err.message}`);
    }
    await sleep(PACING_MS);
  }

  fs.writeFileSync(OUT, JSON.stringify(existing, null, 0));
  console.log(`Wrote ${OUT}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
