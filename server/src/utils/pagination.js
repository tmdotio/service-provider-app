/**
 * Read ?page=&limit= from the query string with safe defaults.
 *
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const getPagination = (query, defaultLimit = 10, maxLimit = 50) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || defaultLimit, 1),
    maxLimit,
  );

  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Pagination block returned to the client.
 */
export const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

/**
 * Escape user text before putting it in a RegExp.
 */
export const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
