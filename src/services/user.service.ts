import type { Prisma } from "@prisma/client";
import { normalizeLocation } from "../lib/place";
import { prisma } from "../db";
import { isCurrentStudent } from "../lib/class-year";
import { BadRequest, NotFound } from "../lib/errors";
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

  // One spelling per city, whatever the caller sent. The client normalizes
  // as you type, but the client is not the only thing that can post here.
  const normalized = "location" in input
    ? { ...input, location: normalizeLocation(input.location) }
    : input;
  const merged = { ...existing, ...normalized };
  const profile = await prisma.profile.update({
    where: { userId },
    data: {
      ...normalized,
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

/**
 * A profile photo the site holds itself.
 *
 * The client downscales to a square JPEG before sending, so what arrives
 * here is small. The cap below is a backstop against a caller that is not
 * the client, not a guess at what a photo weighs.
 */
const MAX_PHOTO_BYTES = 400 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const setMyPhoto = async (userId: string, dataUrl: string) => {
  const match = /^data:([a-z/+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) throw BadRequest("Send the photo as a base64 data URL");

  const [, contentType, base64] = match;
  if (!ALLOWED_PHOTO_TYPES.has(contentType.toLowerCase())) {
    throw BadRequest("A photo must be a JPEG, PNG, or WebP");
  }

  const data = Buffer.from(base64, "base64");
  if (data.length === 0) throw BadRequest("That photo is empty");
  if (data.length > MAX_PHOTO_BYTES) throw BadRequest("That photo is too large");

  // Re-check the bytes rather than trusting the declared type: the magic
  // number is the only thing here the caller cannot simply assert.
  if (!looksLikeImage(data)) throw BadRequest("That file is not an image");

  const photo = await prisma.profilePhoto.upsert({
    where: { userId },
    create: { userId, data, contentType: contentType.toLowerCase() },
    update: { data, contentType: contentType.toLowerCase() },
  });

  // The URL carries the photo's id, which changes on every upload, so a
  // replaced photo is never served from a cache under its old address.
  const url = `/api/photos/${photo.id}`;
  await prisma.profile.update({ where: { userId }, data: { photoUrl: url } });
  return { photoUrl: url };
};

export const clearMyPhoto = async (userId: string) => {
  await prisma.profilePhoto.deleteMany({ where: { userId } });
  await prisma.profile.update({ where: { userId }, data: { photoUrl: null } });
  return { photoUrl: null };
};

export const getPhoto = async (id: string) =>
  prisma.profilePhoto.findUnique({ where: { id }, select: { data: true, contentType: true } });

const looksLikeImage = (buf: Buffer) => {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF. PNG: 89 50 4E 47. WebP: "RIFF"...."WEBP".
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;
  return false;
};
