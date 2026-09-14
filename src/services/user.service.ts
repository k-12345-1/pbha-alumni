import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { isCurrentStudent } from "../lib/class-year";
import { NotFound } from "../lib/errors";
import type { PrivacyUpdateInput, ProfileUpdateInput } from "../schemas/user.schema";
import { invalidateDirectoryFacets } from "./directory.service";

const profileSelect = {
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
  gender: true,
  raceEthnicity: true,
  programs: true,
  programYears: true,
  pbhaRole: true,
  involvement: true,
  openToMentor: true,
  reachOut: true,
  claimedAt: true,
  createdAt: true,
} satisfies Prisma.ProfileSelect;

// The lowercased haystack the directory search matches against, rebuilt on
// every profile write so it can never drift from the columns it summarizes.
export const buildSearchText = (p: {
  first: string;
  last: string;
  location?: string | null;
  career?: string | null;
  industry?: string | null;
  concentration?: string | null;
  pbhaRole?: string | null;
  house?: string | null;
  involvement?: string | null;
  programs?: string[];
}): string =>
  [
    p.first,
    p.last,
    p.location,
    p.career,
    p.industry,
    p.concentration,
    p.pbhaRole,
    p.house,
    p.involvement,
    ...(p.programs ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const getProfile = async (userId: string, viewerId: string) => {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { ...profileSelect, user: { select: { status: true, deletedAt: true, privacy: true } } },
  });
  if (!profile || profile.user.status !== "ACTIVE" || profile.user.deletedAt) {
    throw NotFound("Profile not found");
  }

  // PRIVATE profiles are readable only by their owner. Without this check the
  // directory's privacy filter would be trivially bypassed by requesting a
  // user id directly.
  const isSelf = userId === viewerId;
  if (!isSelf && profile.user.privacy?.profileVisibility === "PRIVATE") {
    throw NotFound("Profile not found");
  }

  const { user, ...rest } = profile;

  // Identity is withheld unless its owner has turned it on. Stripping it here
  // rather than filtering in the UI means it never leaves the server for
  // someone who is not entitled to it.
  const identityVisible = isSelf || user.privacy?.showIdentity === true;

  return {
    ...rest,
    gender: identityVisible ? rest.gender : null,
    raceEthnicity: identityVisible ? rest.raceEthnicity : [],
    isCurrentStudent: isCurrentStudent(rest.year),
    isSelf,
    openToMessages: user.privacy?.openToMessages ?? true,
    showIdentity: user.privacy?.showIdentity ?? false,
  };
};

export const updateMyProfile = async (userId: string, input: ProfileUpdateInput) => {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (!existing) throw NotFound("Profile not found");

  const merged = { ...existing, ...input };
  const profile = await prisma.profile.update({
    where: { userId },
    data: {
      ...input,
      programYears: input.programYears as Prisma.InputJsonValue | undefined,
      searchText: buildSearchText({
        first: merged.first,
        last: merged.last,
        location: merged.location,
        career: merged.career,
        industry: merged.industry,
        concentration: merged.concentration,
        pbhaRole: merged.pbhaRole,
        house: merged.house,
        involvement: merged.involvement,
        programs: merged.programs,
      }),
    },
    select: profileSelect,
  });

  // year / industry / location / programs all feed the facet counts.
  invalidateDirectoryFacets();
  return { ...profile, isCurrentStudent: isCurrentStudent(profile.year) };
};

export const getMyPrivacy = async (userId: string) => {
  const privacy = await prisma.privacySettings.findUnique({ where: { userId } });
  if (privacy) return privacy;
  // Older accounts predate the row; create it lazily with the defaults rather
  // than 404-ing the settings screen.
  return prisma.privacySettings.create({ data: { userId } });
};

export const updateMyPrivacy = async (userId: string, input: PrivacyUpdateInput) => {
  const privacy = await prisma.privacySettings.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });
  invalidateDirectoryFacets();
  return privacy;
};
