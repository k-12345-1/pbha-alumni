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

const INDUSTRIES = [
  "Education", "Healthcare", "Business", "Legal", "Government", "Social Services",
  "Sciences", "Technology", "Arts & Media", "Community Organizing", "Finance",
  "Health & Medicine", "Housing", "Journalism", "Law & Policy", "Nonprofit",
  "Philanthropy", "Public Health", "Research", "Student", "Other",
];

const PBHA_ROLES = [
  "Volunteer",
  "Program Coordinator",
  "Program Director",
  "Summer Director",
  "Cabinet",
  "Officer",
];


const HOUSES = [
  "Adams", "Cabot", "Currier", "Dudley", "Dunster", "Eliot", "Kirkland", "Leverett",
  "Lowell", "Mather", "Pforzheimer", "Quincy", "Winthrop", "First-year (Yard)", "Non-resident",
];

const GENDER_OPTIONS = [
  "Woman", "Man", "Non-binary", "Prefer to self-describe", "Prefer not to say",
];

const RACE_OPTIONS = [
  "American Indian or Alaska Native", "Asian", "Black or African American",
  "Hispanic or Latino/a/e", "Middle Eastern or North African",
  "Native Hawaiian or Pacific Islander", "White",
  "Prefer to self-describe", "Prefer not to say",
];

// Drift guard: every name here must appear in the TypeScript source.
const ts = fs.readFileSync(path.resolve(__dirname, "../src/lib/programs.ts"), "utf8");
for (const name of [...PROGRAMS, ...PBHA_ROLES, ...HOUSES, ...GENDER_OPTIONS, ...RACE_OPTIONS, ...INDUSTRIES]) {
  if (!ts.includes(JSON.stringify(name).slice(1, -1).replace(/\\"/g, '"'))) {
    throw new Error(`scripts/vocab.js is out of sync with src/lib/programs.ts: "${name}" is missing there`);
  }
}

module.exports = { PROGRAMS, PBHA_ROLES, HOUSES, GENDER_OPTIONS, RACE_OPTIONS, INDUSTRIES };
