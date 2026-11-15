import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../api/axios";

/**
 * Small data-fetching hook.
 *
 *   const { data, loading, error, refetch } = useFetch(() => api.get("/x"), [dep]);
 *
 * Ignores responses from old requests when deps change quickly
 * (e.g. typing in the search box).
 */
export default function useFetch(requestFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const request = useCallback(requestFn, deps);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    request()
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [request, reloadKey]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  return { data, loading, error, refetch, setData };
}
