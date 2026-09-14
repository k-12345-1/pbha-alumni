// PBHA program names, as published on pbha.org. PBHA runs 80+ student-run
// programs; this is the subset the directory seeds and suggests. Program
// names are stored on Profile as plain strings, so adding one here is a
// content change, never a migration.
export const PROGRAMS = [
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
] as const;

// PBHA roles, most senior last. Used for the role filter and the seed data.
export const PBHA_ROLES = [
  "Volunteer",
  "Program Coordinator",
  "Program Director",
  "Summer Director",
  "Cabinet",
  "Officer",
] as const;

export type PbhaRole = (typeof PBHA_ROLES)[number];

// Harvard Houses, plus the two answers that are not a House. Offered as
// suggestions in the profile editor; the column is free text, so a member
// can type something else and a renamed House needs no migration.
export const HOUSES = [
  "Adams",
  "Cabot",
  "Currier",
  "Dudley",
  "Dunster",
  "Eliot",
  "Kirkland",
  "Leverett",
  "Lowell",
  "Mather",
  "Pforzheimer",
  "Quincy",
  "Winthrop",
  "First-year (Yard)",
  "Non-resident",
] as const;

// Identity options. Every list ends in an open answer, and none of it is
// required — see the showIdentity note in the schema for why it is collected
// and why it stays private by default.
export const GENDER_OPTIONS = [
  "Woman",
  "Man",
  "Non-binary",
  "Prefer to self-describe",
  "Prefer not to say",
] as const;

export const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino/a/e",
  "Middle Eastern or North African",
  "Native Hawaiian or Pacific Islander",
  "White",
  "Prefer to self-describe",
  "Prefer not to say",
] as const;
