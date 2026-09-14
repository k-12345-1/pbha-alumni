import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { isCurrentStudent, studentBoundaryYear } from "../lib/class-year";
import { buildPageMeta, skipTake } from "../lib/pagination";
import type { DirectoryQuery } from "../schemas/user.schema";

const directoryCardSelect = {
  userId: true,
  first: true,
  last: true,
  pronouns: true,
  year: true,
  location: true,
  photoUrl: true,
  career: true,
  industry: true,
  concentration: true,
  house: true,
  bio: true,
  // gender / raceEthnicity are deliberately absent. Identity is not a
  // directory card field even for members who have made it visible; it is
  // shown on the profile itself, and only then. See PrivacySettings.

  programs: true,
  // Ships with the list so the years on each program chip are present the
  // moment a profile opens, instead of appearing a beat late after refetch.
  programYears: true,
  pbhaRole: true,
  involvement: true,
  openToMentor: true,
  reachOut: true,
  // Null marks a bulk-imported profile nobody has claimed. The frontend
  // renders those with an INVITED treatment and shows name + year only.
  claimedAt: true,
  createdAt: true,
} satisfies Prisma.ProfileSelect;

// Who belongs in the directory at all: active accounts, plus bulk-imported
// profiles that have not been claimed yet so the directory is useful on day
// one. Mid-signup accounts stay hidden.
const LISTABLE_USER = {
  status: "ACTIVE" as const,
  deletedAt: null,
};

export const searchDirectory = async (q: DirectoryQuery, viewerId: string) => {
  // Privacy: a member sees their own card unconditionally (so "this is what
  // others see" previews work), plus every profile that is listed and set to
  // ALUMNI visibility. This clause must stay in `where.OR` and any later
  // filter must be AND-ed onto `where.AND` — writing to `where.OR` would drop
  // the privacy filter entirely and leak PRIVATE profiles to any caller.
  const where: Prisma.ProfileWhereInput = {
    OR: [
      { userId: viewerId },
      {
        user: {
          ...LISTABLE_USER,
          privacy: { is: { showInDirectory: true, profileVisibility: "ALUMNI" } },
        },
      },
    ],
  };

  const and: Prisma.ProfileWhereInput[] = [{ user: LISTABLE_USER }];

  // Student vs alumni is derived from class year, so the `who` filter becomes
  // a range on the indexed `year` column. Compose it with any caller-supplied
  // yearFrom / yearTo so both apply.
  const yearFilter: Prisma.IntFilter = {};
  if (q.who === "alumni") yearFilter.lt = studentBoundaryYear();
  if (q.who === "students") yearFilter.gte = studentBoundaryYear();
  if (q.yearFrom !== undefined) {
    yearFilter.gte = Math.max(yearFilter.gte ?? Number.NEGATIVE_INFINITY, q.yearFrom);
  }
  if (q.yearTo !== undefined) yearFilter.lte = q.yearTo;
  if (Object.keys(yearFilter).length > 0) and.push({ year: yearFilter });

  if (q.industry?.length) and.push({ industry: { in: q.industry } });
  if (q.program?.length) and.push({ programs: { hasSome: q.program } });
  if (q.house?.length) and.push({ house: { in: q.house } });
  if (q.role?.length) and.push({ pbhaRole: { in: q.role } });
  if (q.openToMentor === true) and.push({ openToMentor: true });

  if (q.q?.trim()) {
    const term = q.q.trim().toLowerCase();
    and.push({
      OR: [
        { searchText: { contains: term } },
        { first: { contains: term, mode: "insensitive" } },
        { last: { contains: term, mode: "insensitive" } },
        { career: { contains: term, mode: "insensitive" } },
        { industry: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
        { house: { contains: term, mode: "insensitive" } },
        { programs: { hasSome: [q.q.trim()] } },
      ],
    });
  }

  where.AND = and;

  let orderBy: Prisma.ProfileOrderByWithRelationInput[];
  switch (q.sort) {
    case "year-desc":
      orderBy = [{ year: "desc" }, { last: "asc" }];
      break;
    case "year-asc":
      orderBy = [{ year: "asc" }, { last: "asc" }];
      break;
    case "name":
      orderBy = [{ last: "asc" }, { first: "asc" }];
      break;
    case "recent":
    default:
      // "Recently joined" means recently claimed, not recently imported —
      // createdAt is the bulk-import date and is uniform across a whole
      // batch. nulls:"last" pushes unclaimed profiles to the bottom.
      orderBy = [{ claimedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
      break;
  }

  const [items, total] = await Promise.all([
    prisma.profile.findMany({ where, orderBy, ...skipTake(q), select: directoryCardSelect }),
    prisma.profile.count({ where }),
  ]);

  // Claimed profiles always sort above unclaimed ones, whatever the selected
  // sort. The "recent" sort gets this from nulls:"last", but year and name
  // sorts would otherwise interleave them. Array.sort is stable, so the
  // DB-side ordering survives within each group.
  items.sort((a, b) => Number(!!b.claimedAt) - Number(!!a.claimedAt));

  return {
    items: items.map((it) => ({ ...it, isCurrentStudent: isCurrentStudent(it.year) })),
    meta: buildPageMeta(q, total),
  };
};

type DirectoryFacets = {
  programs: { name: string; count: number }[];
  industries: { name: string; count: number }[];
  locations: { name: string; count: number }[];
  roles: { name: string; count: number }[];
  houses: { name: string; count: number }[];
  totalAlumni: number;
  totalStudents: number;
};

// The facet aggregates are site-wide and change slowly (only when someone
// edits their profile or signs up), but they are the heaviest query per
// request — several full scans of Profile. A short in-memory cache removes
// almost all of that work with no staleness anyone would notice.
const FACETS_CACHE_TTL_MS = 60 * 1000;
let facetsCache: { data: DirectoryFacets; expiresAt: number } | null = null;
let inflightFacets: Promise<DirectoryFacets> | null = null;

const computeDirectoryFacets = async (): Promise<DirectoryFacets> => {
  const cutoff = studentBoundaryYear();
  const listed = {
    user: { ...LISTABLE_USER, privacy: { is: { showInDirectory: true } } },
  } satisfies Prisma.ProfileWhereInput;

  const [industries, locations, roles, houses, totalAlumni, totalStudents, programRows] =
    await Promise.all([
      prisma.profile.groupBy({
        by: ["industry"],
        _count: { _all: true },
        where: { ...listed, industry: { not: null } },
        orderBy: { industry: "asc" },
        take: 60,
      }),
      prisma.profile.groupBy({
        by: ["location"],
        _count: { _all: true },
        where: { ...listed, location: { not: null } },
        orderBy: { _count: { location: "desc" } },
        take: 200,
      }),
      prisma.profile.groupBy({
        by: ["pbhaRole"],
        _count: { _all: true },
        where: { ...listed, pbhaRole: { not: null } },
        orderBy: { pbhaRole: "asc" },
        take: 40,
      }),
      prisma.profile.groupBy({
        by: ["house"],
        _count: { _all: true },
        where: { ...listed, house: { not: null } },
        orderBy: { house: "asc" },
        take: 40,
      }),
      prisma.profile.count({ where: { ...listed, year: { lt: cutoff } } }),
      prisma.profile.count({ where: { ...listed, year: { gte: cutoff } } }),
      // programs is a String[], which groupBy cannot unnest, so the counts are
      // tallied in app code over just that column.
      prisma.profile.findMany({ where: listed, select: { programs: true } }),
    ]);

  const programCounts = new Map<string, number>();
  for (const row of programRows) {
    for (const p of row.programs) programCounts.set(p, (programCounts.get(p) ?? 0) + 1);
  }

  return {
    programs: [...programCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    industries: industries.map((i) => ({ name: i.industry!, count: i._count._all })),
    locations: locations.map((l) => ({ name: l.location!, count: l._count._all })),
    roles: roles.map((r) => ({ name: r.pbhaRole!, count: r._count._all })),
    houses: houses.map((h) => ({ name: h.house!, count: h._count._all })),
    totalAlumni,
    totalStudents,
  };
};

export const getDirectoryFacets = async (): Promise<DirectoryFacets> => {
  const now = Date.now();
  if (facetsCache && facetsCache.expiresAt > now) return facetsCache.data;
  // Single-flight: concurrent callers await one recompute instead of
  // stampeding the database.
  if (inflightFacets) return inflightFacets;
  inflightFacets = computeDirectoryFacets()
    .then((data) => {
      facetsCache = { data, expiresAt: Date.now() + FACETS_CACHE_TTL_MS };
      return data;
    })
    .finally(() => {
      inflightFacets = null;
    });
  return inflightFacets;
};

// Call after any write that changes who is listed or how they are tallied:
// signup, profile update, privacy change, suspension, deletion. Without it
// the sidebar counts lag by up to FACETS_CACHE_TTL_MS.
export const invalidateDirectoryFacets = (): void => {
  facetsCache = null;
};
