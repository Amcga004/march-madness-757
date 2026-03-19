"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshClientProps = {
  intervalMs?: number;
  hiddenIntervalMs?: number;
  refreshOnFocus?: boolean;
  minimumGapMs?: number;
};

export default function AutoRefreshClient({
  intervalMs = 5000,
  hiddenIntervalMs = 20000,
  refreshOnFocus = true,
  minimumGapMs = 1200,
}: AutoRefreshClientProps) {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    function clearScheduledRefresh() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function markRefresh() {
      lastRefreshAtRef.current = Date.now();
      isRefreshingRef.current = true;

      try {
        router.refresh();
      } finally {
        window.setTimeout(() => {
          isRefreshingRef.current = false;
        }, 800);
      }
    }

    function safeRefresh() {
      const now = Date.now();

      if (document.hidden) return;
      if (!navigator.onLine) return;
      if (isRefreshingRef.current) return;
      if (now - lastRefreshAtRef.current < minimumGapMs) return;

      markRefresh();
    }

    function scheduleNextRefresh(delay: number) {
      clearScheduledRefresh();

      timeoutRef.current = window.setTimeout(() => {
        safeRefresh();
        scheduleNextRefresh(document.hidden ? hiddenIntervalMs : intervalMs);
      }, delay);
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        if (refreshOnFocus && navigator.onLine) {
          safeRefresh();
        }
        scheduleNextRefresh(intervalMs);
      } else {
        scheduleNextRefresh(hiddenIntervalMs);
      }
    }

    function handleWindowFocus() {
      if (!refreshOnFocus) return;
      if (!navigator.onLine) return;

      safeRefresh();
      scheduleNextRefresh(intervalMs);
    }

    function handleOnline() {
      safeRefresh();
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
  }, [router, intervalMs, hiddenIntervalMs, refreshOnFocus, minimumGapMs]);

  return null;
}