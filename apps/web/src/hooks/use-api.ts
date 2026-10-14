import { useCallback, useEffect, useState } from "react";

export function useApi<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch(() => {
        if (alive) setError("request-failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetcher, attempt]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  return { data, error, loading, reload };
}
