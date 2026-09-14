import { z } from "zod";
import { noEmoji, NO_EMOJI_MSG } from "./auth.schema";
import { pageFields } from "../lib/pagination";

// A photo is uploaded, not linked, so the only URL the client may send back
// is one this site issued. Everything else — including data: URLs — is
// refused, which is what keeps a photo from becoming an XSS vector if it is
// ever rendered into an href rather than an img src.
const ownPhotoUrl = z
  .string()
  .trim()
  .max(120)
  .refine((s) => /^\/api\/photos\/[A-Za-z0-9_-]+$/.test(s), "photoUrl must be an uploaded photo");

export const profileUpdateSchema = z
  .object({
    first: z.string().trim().min(1).max(60).refine(noEmoji, NO_EMOJI_MSG).optional(),
    last: z.string().trim().min(1).max(60).refine(noEmoji, NO_EMOJI_MSG).optional(),
    pronouns: z.string().max(40).nullable().optional(),
    year: z.coerce.number().int().min(1904).max(2050).optional(),
    location: z.string().max(120).nullable().optional(),
    photoUrl: ownPhotoUrl.nullable().optional(),

    career: z.string().max(160).nullable().optional(),
    industry: z.string().max(60).nullable().optional(),
    concentration: z.string().max(80).nullable().optional(),
    house: z.string().max(60).nullable().optional(),
    bio: z.string().max(1500).nullable().optional(),

    // Self-reported and always optional.
    gender: z.string().max(80).nullable().optional(),
    raceEthnicity: z.array(z.string().min(1).max(80)).max(12).optional(),

    programs: z.array(z.string().min(1).max(120)).max(30).optional(),
    programYears: z.record(z.string(), z.string().max(120)).optional(),
    pbhaRole: z.string().max(80).nullable().optional(),
    involvement: z.string().max(2000).nullable().optional(),

    openToMentor: z.boolean().optional(),
    reachOut: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const privacyUpdateSchema = z
  .object({
    profileVisibility: z.enum(["ALUMNI", "PRIVATE"]).optional(),
    showInDirectory: z.boolean().optional(),
    openToMessages: z.boolean().optional(),
    showIdentity: z.boolean().optional(),
  })
  .strict();

const asArray = <T>(v: T | T[] | undefined): T[] | undefined =>
  v === undefined ? undefined : Array.isArray(v) ? v : [v];

export const directoryQuerySchema = z.object({
  q: z.string().max(120).optional(),
  yearFrom: z.coerce.number().int().min(1904).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1904).max(2100).optional(),
  industry: z.union([z.string(), z.array(z.string())]).optional().transform(asArray),
  program: z.union([z.string(), z.array(z.string())]).optional().transform(asArray),
  house: z.union([z.string(), z.array(z.string())]).optional().transform(asArray),
  role: z.union([z.string(), z.array(z.string())]).optional().transform(asArray),
  openToMentor: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === "true")),
  who: z.enum(["all", "alumni", "students"]).default("all"),
  sort: z.enum(["recent", "year-desc", "year-asc", "name"]).default("recent"),
  // The page renders the whole directory in one fetch — there is no
  // load-more UI, so anything past pageSize is silently invisible. Raise this
  // in lockstep with the frontend's pageSize as the roster grows.
  ...pageFields({ maxPageSize: 2000, defaultPageSize: 48 }),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PrivacyUpdateInput = z.infer<typeof privacyUpdateSchema>;
export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;

// The photo itself, as a base64 data URL. The ceiling here is the JSON
// string; the byte cap that matters is enforced in the service, after
// decoding, where a caller cannot pad its way past it.
export const photoUploadSchema = z.object({
  dataUrl: z.string().min(32).max(700_000),
});
