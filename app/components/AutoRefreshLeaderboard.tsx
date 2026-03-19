"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AutoRefreshLeaderboard() {
  const router = useRouter();
  const refreshTimeoutRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();

    function queueRefresh() {
      const now = Date.now();

      if (document.hidden) return;
      if (!navigator.onLine) return;
      if (now - lastRefreshAtRef.current < 800) return;

      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        lastRefreshAtRef.current = Date.now();
        router.refresh();
        refreshTimeoutRef.current = null;
      }, 250);
    }

    const channel = supabase
      .channel("global-live-refresh")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "picks",
        },
        queueRefresh
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
        },
        queueRefresh
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_results",
        },
        queueRefresh
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "external_game_sync",
        },
        queueRefresh
      )

      .subscribe();

    function handleFocus() {
      if (document.hidden) return;
      if (!navigator.onLine) return;
      queueRefresh();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);

      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}