/**
 * Demo seed for local development.
 *
 * Every person below is invented. Do NOT run this against a database holding
 * real member data — it upserts by email and would overwrite a live profile
 * that happened to share one of these addresses.
 *
 *   npm run seed
 *
 * All seeded accounts share the password in SEED_PASSWORD.
 */
import { prisma } from "../db";
import { hashPassword } from "../lib/auth";
import { buildSearchText } from "../services/user.service";
// Shared with scripts/build-demo.js, which bakes the same people into the
// static GitHub Pages demo. One source of truth for the invented roster.
import demoPeople from "./demo-people.json";

const SEED_PASSWORD = "pbha-demo-2026";

type Seed = {
  email: string;
  first: string;
  last: string;
  year: number;
  location?: string;
  career?: string;
  industry?: string;
  concentration?: string;
  pbhaRole?: string;
  programs: string[];
  bio?: string;
  openToMentor?: boolean;
  reachOut?: string;
  // Unclaimed rows model a bulk import: the person is in the directory but
  // has not signed in yet, so the card shows name and class year only.
  unclaimed?: boolean;
};

const PEOPLE: Seed[] = demoPeople as Seed[];

const main = async () => {
  const passwordHash = await hashPassword(SEED_PASSWORD);

  for (const p of PEOPLE) {
    const profileData = {
      first: p.first,
      last: p.last,
      year: p.year,
      location: p.location ?? null,
      career: p.career ?? null,
      industry: p.industry ?? null,
      concentration: p.concentration ?? null,
      pbhaRole: p.pbhaRole ?? null,
      programs: p.programs,
      bio: p.bio ?? null,
      openToMentor: p.openToMentor ?? false,
      reachOut: p.reachOut ?? null,
      claimedAt: p.unclaimed ? null : new Date(),
      searchText: buildSearchText(p),
    };

    await prisma.user.upsert({
      where: { email: p.email },
      create: {
        email: p.email,
        passwordHash,
        emailVerified: !p.unclaimed,
        termsAcceptedAt: p.unclaimed ? null : new Date(),
        profile: { create: profileData },
        privacy: { create: {} },
      },
      update: {
        profile: { upsert: { create: profileData, update: profileData } },
        privacy: { upsert: { create: {}, update: {} } },
      },
    });
  }

  console.log(`Seeded ${PEOPLE.length} demo profiles. Password: ${SEED_PASSWORD}`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
