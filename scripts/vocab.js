/* eslint-disable */
// CommonJS mirror of src/lib/programs.ts, so build-demo.js can read the same
// vocabulary without a TypeScript build step. Keep the two in sync — the
// check at the bottom of this file fails the build if they drift.
const fs = require("node:fs");
const path = require("node:path");

const PROGRAMS = [
  "Adult ESOL Program",
  "Alzheimer's Buddies",
  "Best Buddies",
  "Boston Refugee Youth Enrichment (BRYE) Extension",
  "Boston Refugee Youth Enrichment (BRYE) Teen",
  "BRYE 1-2-1",
  "BRYE Summer",
  "BRYE Tutoring",
  "Cambridge After-School Program (CASP)",
  "Cambridge Youth Enrichment Program",
  "Chinatown Adventure",
  "Chinatown Afterschool Program (CHAP)",
  "Chinatown Big Sibling",
  "Chinatown Citizenship",
  "Chinatown ESL",
  "Chinatown Teen",
  "CIVICS",
  "College High-School Alliance (CHANCE)",
  "Summer Urban Program",
];

const PBHA_ROLES = [
  "Volunteer",
  "Program Coordinator",
  "Program Director",
  "Summer Director",
  "Cabinet",
  "Officer",
];

// Drift guard: every name here must appear in the TypeScript source.
const ts = fs.readFileSync(path.resolve(__dirname, "../src/lib/programs.ts"), "utf8");
for (const name of [...PROGRAMS, ...PBHA_ROLES]) {
  if (!ts.includes(JSON.stringify(name).slice(1, -1).replace(/\\"/g, '"'))) {
    throw new Error(`scripts/vocab.js is out of sync with src/lib/programs.ts: "${name}" is missing there`);
  }
}

module.exports = { PROGRAMS, PBHA_ROLES };
