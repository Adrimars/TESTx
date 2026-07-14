export type PageParams = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

// Tolerates missing / non-numeric query values (e.g. ?page=abc → NaN) by
// falling back to safe defaults instead of letting NaN reach Prisma.
export function parsePageParams(
  query: { page?: string; limit?: string },
  defaultLimit: number,
  maxLimit = 100
): PageParams {
  const pageNum = Number(query.page);
  const limitNum = Number(query.limit);

  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;
  const limit =
    Number.isFinite(limitNum) && limitNum >= 1
      ? Math.min(maxLimit, Math.floor(limitNum))
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit, take: limit };
}
