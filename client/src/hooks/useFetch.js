import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/axios";

/*
 * Small in-memory cache shared by all pages (stale-while-revalidate):
 *
 * - First visit: show a skeleton, load from the API (which uses Redis).
 * - Next visits: show the saved data INSTANTLY (no skeleton), and
 *   quietly ask the API for fresh data in the background.
 *
 * Only requests that pass a `key` are cached. Cleared on login/logout.
 */
const memory = new Map();
const MAX_ENTRIES = 80;

const remember = (key, data) => {
  memory.delete(key);
  memory.set(key, data);
  // Keep memory small: drop the oldest entries
  while (memory.size > MAX_ENTRIES) {
    memory.delete(memory.keys().next().value);
  }
};

export const clearFetchCache = () => memory.clear();

/** For pages that build their own list (e.g. the feed with "Load more") */
export const readCache = (key) => memory.get(key);
export const writeCache = (key, data) => remember(key, data);

/**
 *   const { data, loading, error, refetch, setData } =
 *     useFetch(() => api.get("/x"), [dep], "x-cache-key");
 *
 * Ignores responses from old requests when deps change quickly
 * (e.g. typing in the search box).
 */
export default function useFetch(requestFn, deps = [], key = null) {
  const [data, setDataState] = useState(() => (key && memory.has(key) ? memory.get(key) : null));
  const [loading, setLoading] = useState(() => !(key && memory.has(key)));
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const keyRef = useRef(key);
  keyRef.current = key;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const request = useCallback(requestFn, deps);

  useEffect(() => {
    let active = true;
    const cached = key && memory.has(key);

    // Saved data: show it now, refresh silently. Otherwise: skeleton.
    if (cached) {
      setDataState(memory.get(key));
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    request()
      .then((res) => {
        if (key) remember(key, res.data);
        if (active) setDataState(res.data);
      })
      .catch((err) => {
        if (active && !cached) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [request, reloadKey, key]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // Local edits (new post, deleted comment...) also update the saved copy
  const setData = useCallback((update) => {
    setDataState((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      if (keyRef.current) remember(keyRef.current, next);
      return next;
    });
  }, []);

  return { data, loading, error, refetch, setData };
}
