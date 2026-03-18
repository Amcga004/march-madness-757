"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshClientProps = {
  intervalMs?: number;
  hiddenIntervalMs?: number;
  refreshOnFocus?: boolean;
};

export default function AutoRefreshClient({
  intervalMs = 15000,
  hiddenIntervalMs = 60000,
  refreshOnFocus = true,
}: AutoRefreshClientProps) {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    function clearScheduledRefresh() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function runRefresh() {
      if (document.hidden) {
        scheduleNextRefresh(hiddenIntervalMs);
        return;
      }

      if (!navigator.onLine) {
        scheduleNextRefresh(hiddenIntervalMs);
        return;
      }

      if (isRefreshingRef.current) {
        scheduleNextRefresh(intervalMs);
        return;
      }

      isRefreshingRef.current = true;

      try {
        router.refresh();
      } finally {
        window.setTimeout(() => {
          isRefreshingRef.current = false;
        }, 750);
      }

      scheduleNextRefresh(intervalMs);
    }

    function scheduleNextRefresh(delay: number) {
      clearScheduledRefresh();

      timeoutRef.current = window.setTimeout(() => {
        runRefresh();
      }, delay);
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (refreshOnFocus && navigator.onLine) {
          router.refresh();
        }

        scheduleNextRefresh(intervalMs);
      } else {
        scheduleNextRefresh(hiddenIntervalMs);
      }
    }

    function handleWindowFocus() {
      if (!refreshOnFocus) return;
      if (!navigator.onLine) return;

      router.refresh();
      scheduleNextRefresh(intervalMs);
    }

    function handleOnline() {
      router.refresh();
      scheduleNextRefresh(intervalMs);
    }

    function handleOffline() {
      scheduleNextRefresh(hiddenIntervalMs);
    }

    scheduleNextRefresh(document.hidden ? hiddenIntervalMs : intervalMs);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearScheduledRefresh();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router, intervalMs, hiddenIntervalMs, refreshOnFocus]);

  return null;
}