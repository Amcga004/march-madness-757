import { useState, useEffect, useCallback } from "react";

interface LiveDataOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export function useLiveData<T>(
  fetchFn: () => Promise<T>,
  initialData: T,
  options: LiveDataOptions = {}
) {
  const { intervalMs = 60000, enabled = true } = options;
  const [data, setData] = useState<T>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const fresh = await fetchFn();
      setData(fresh);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("[useLiveData] refresh failed:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [refresh, intervalMs, enabled]);

  return { data, lastUpdated, isRefreshing, refresh };
}
