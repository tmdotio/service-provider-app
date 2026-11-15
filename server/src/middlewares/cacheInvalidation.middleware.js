import { invalidateProviders } from "../services/cache.service.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Writes that never change provider search results or profiles
const IGNORE = [/\/like$/, /\/comments(\/|$)/, /\/refresh-token$/, /\/logout$/, /\/login$/, /\/register$/];

/**
 * Clears the cached provider search results and profiles after any
 * successful change (booking accepted, review added, banner changed...).
 *
 * It runs before the response is sent, so the very next request
 * already gets fresh data. Mounted once in app.js, so no controller
 * can forget to clear the cache.
 */
export const invalidateProvidersOnWrite = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method) || IGNORE.some((re) => re.test(req.path))) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (res.statusCode >= 400) return originalJson(body);

    invalidateProviders()
      .catch(() => {})
      .finally(() => originalJson(body));
    return res;
  };

  next();
};
