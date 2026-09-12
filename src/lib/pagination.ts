import { z } from "zod";

export const pageFields = ({
  maxPageSize = 200,
  defaultPageSize = 24,
}: { maxPageSize?: number; defaultPageSize?: number } = {}) => ({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
});

export const skipTake = (q: { page: number; pageSize: number }) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});

export const buildPageMeta = (q: { page: number; pageSize: number }, total: number) => ({
  page: q.page,
  pageSize: q.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
});
