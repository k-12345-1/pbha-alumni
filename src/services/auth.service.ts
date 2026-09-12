import { prisma } from "../db";
import { env } from "../env";
import { BadRequest, Conflict, Unauthorized } from "../lib/errors";
import { hashPassword, signAccessToken, verifyPassword } from "../lib/auth";
import type { SigninInput, SignupInput } from "../schemas/auth.schema";
import { buildSearchText } from "./user.service";
import { invalidateDirectoryFacets } from "./directory.service";

const issueToken = async (user: { id: string; email: string; role: "ALUM" | "ADMIN" }) => {
  const { token, iat } = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  // Stamp with the JWT's own iat, not a fresh Date.now() — a fresh timestamp
  // can land a second later and invalidate the token on its first request.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastTokenIssuedAt: new Date(iat * 1000) },
  });
  return token;
};

export const signup = async (input: SignupInput) => {
  if (env.SIGNUP_SECRET_CODE) {
    const supplied = (input.inviteCode ?? "").trim().toLowerCase();
    if (supplied !== env.SIGNUP_SECRET_CODE.trim().toLowerCase()) {
      throw BadRequest("That invite code is not valid", "BAD_INVITE_CODE");
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // An unclaimed bulk-imported profile is not a duplicate signup — it is
    // this person arriving for the first time. Set their password, mark the
    // profile claimed, and sign them straight in.
    const profile = await prisma.profile.findUnique({ where: { userId: existing.id } });
    if (profile && !profile.claimedAt) {
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: await hashPassword(input.password),
          emailVerified: true,
          termsAcceptedAt: new Date(),
          profile: { update: { claimedAt: new Date() } },
        },
      });
      invalidateDirectoryFacets();
      return { token: await issueToken(user), userId: user.id, claimed: true };
    }
    throw Conflict("An account already exists for that email", "EMAIL_TAKEN");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      emailVerified: true,
      termsAcceptedAt: new Date(),
      profile: {
        create: {
          first: input.first,
          last: input.last,
          year: input.year,
          programs: [],
          claimedAt: new Date(),
          searchText: buildSearchText({ first: input.first, last: input.last }),
        },
      },
      privacy: { create: {} },
    },
  });

  invalidateDirectoryFacets();
  return { token: await issueToken(user), userId: user.id, claimed: false };
};

export const signin = async (input: SigninInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Same message and roughly the same work whether the email exists or the
  // password is wrong, so the endpoint does not confirm which emails have
  // accounts. The bcrypt compare runs on a dummy hash for missing users.
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
  const ok = await verifyPassword(input.password, hash);
  if (!user || !ok) throw Unauthorized("Email or password is incorrect", "BAD_CREDENTIALS");
  if (user.status === "SUSPENDED") throw Unauthorized("Account is suspended");
  if (user.status === "DELETED" || user.deletedAt) {
    throw Unauthorized("Email or password is incorrect", "BAD_CREDENTIALS");
  }

  // First real sign-in on a bulk-imported profile claims it.
  await prisma.profile.updateMany({
    where: { userId: user.id, claimedAt: null },
    data: { claimedAt: new Date() },
  });

  return { token: await issueToken(user), userId: user.id };
};

export const me = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      profile: {
        select: {
          first: true,
          last: true,
          year: true,
          photoUrl: true,
          pbhaRole: true,
          claimedAt: true,
        },
      },
      privacy: true,
    },
  });
  if (!user || user.status !== "ACTIVE") throw Unauthorized();
  return user;
};

export const changePassword = async (userId: string, current: string, next: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Unauthorized();
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw BadRequest("Current password is incorrect", "BAD_PASSWORD");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next) },
  });
};
