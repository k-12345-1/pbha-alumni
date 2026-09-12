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
