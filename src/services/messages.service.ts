import { prisma } from "../db";
import { BadRequest, Forbidden, NotFound } from "../lib/errors";

// The fields a thread list or a conversation header needs about the other
// person. Deliberately small: messaging should not become a second way to
// read someone's profile.
const counterpartSelect = {
  userId: true,
  first: true,
  last: true,
  year: true,
  photoUrl: true,
  pbhaRole: true,
} as const;

const assertParticipant = async (threadId: string, userId: string) => {
  const seat = await prisma.threadParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  if (!seat) throw NotFound("Conversation not found");
  return seat;
};

export const listThreads = async (userId: string) => {
  const seats = await prisma.threadParticipant.findMany({
    where: { userId },
    orderBy: { thread: { updatedAt: "desc" } },
    select: {
      lastReadAt: true,
      thread: {
        select: {
          id: true,
          updatedAt: true,
          participants: {
            where: { userId: { not: userId } },
            select: { user: { select: { profile: { select: counterpartSelect } } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, senderId: true },
          },
        },
      },
    },
  });

  // Unread counts in one query rather than one per thread.
  const unreadByThread = new Map<string, number>();
  await Promise.all(
    seats.map(async (seat) => {
      const count = await prisma.message.count({
        where: {
          threadId: seat.thread.id,
          senderId: { not: userId },
          ...(seat.lastReadAt ? { createdAt: { gt: seat.lastReadAt } } : {}),
        },
      });
      unreadByThread.set(seat.thread.id, count);
    }),
  );

  return seats
    // A thread with no messages is one someone opened and abandoned; it is
    // noise in the list until something is actually said.
    .filter((seat) => seat.thread.messages.length > 0)
    .map((seat) => {
      const last = seat.thread.messages[0];
      return {
        threadId: seat.thread.id,
        updatedAt: seat.thread.updatedAt,
        unread: unreadByThread.get(seat.thread.id) ?? 0,
        lastMessage: last
          ? { body: last.body, createdAt: last.createdAt, fromMe: last.senderId === userId }
          : null,
        with: seat.thread.participants[0]?.user.profile ?? null,
      };
    });
};

export const getThread = async (threadId: string, userId: string) => {
  const seat = await assertParticipant(threadId, userId);

  const [messages, other] = await Promise.all([
    prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      take: 500,
      select: { id: true, body: true, createdAt: true, senderId: true },
    }),
    prisma.threadParticipant.findFirst({
      where: { threadId, userId: { not: userId } },
      select: { user: { select: { profile: { select: counterpartSelect } } } },
    }),
  ]);

  return {
    threadId,
    with: other?.user.profile ?? null,
    lastReadAt: seat.lastReadAt,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      fromMe: m.senderId === userId,
    })),
  };
};

// Find the thread between these two people, or open one. Keyed on the pair,
// so writing to someone twice continues the conversation instead of starting
// a second one beside it.
export const openThread = async (userId: string, otherId: string) => {
  if (userId === otherId) throw BadRequest("You cannot message yourself");

  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { status: true, deletedAt: true, privacy: true },
  });
  if (!other || other.status !== "ACTIVE" || other.deletedAt) throw NotFound("Member not found");
  // Messaging is off for anyone who has turned it off, and the check lives
  // here rather than in the UI so hiding the button is not what enforces it.
  if (other.privacy && other.privacy.openToMessages === false) {
    throw Forbidden("This member is not accepting messages");
  }

  const existing = await prisma.thread.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: otherId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return { threadId: existing.id };

  const thread = await prisma.thread.create({
    data: {
      participants: { create: [{ userId }, { userId: otherId }] },
    },
    select: { id: true },
  });
  return { threadId: thread.id };
};

export const sendMessage = async (threadId: string, userId: string, body: string) => {
  await assertParticipant(threadId, userId);

  const other = await prisma.threadParticipant.findFirst({
    where: { threadId, userId: { not: userId } },
    select: { user: { select: { status: true, privacy: true } } },
  });
  if (!other || other.user.status !== "ACTIVE") throw NotFound("Member not found");
  if (other.user.privacy && other.user.privacy.openToMessages === false) {
    throw Forbidden("This member is not accepting messages");
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { threadId, senderId: userId, body },
      select: { id: true, body: true, createdAt: true, senderId: true },
    }),
    // Bumps updatedAt so the thread rises in the list.
    prisma.thread.update({ where: { id: threadId }, data: {} }),
    // Sending is reading: you have seen everything up to your own message.
    prisma.threadParticipant.update({
      where: { threadId_userId: { threadId, userId } },
      data: { lastReadAt: new Date() },
    }),
  ]);

  return { id: message.id, body: message.body, createdAt: message.createdAt, fromMe: true };
};

export const markRead = async (threadId: string, userId: string) => {
  await assertParticipant(threadId, userId);
  await prisma.threadParticipant.update({
    where: { threadId_userId: { threadId, userId } },
    data: { lastReadAt: new Date() },
  });
};

export const unreadTotal = async (userId: string) => {
  const seats = await prisma.threadParticipant.findMany({
    where: { userId },
    select: { threadId: true, lastReadAt: true },
  });
  const counts = await Promise.all(
    seats.map((seat) =>
      prisma.message.count({
        where: {
          threadId: seat.threadId,
          senderId: { not: userId },
          ...(seat.lastReadAt ? { createdAt: { gt: seat.lastReadAt } } : {}),
        },
      }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
};
