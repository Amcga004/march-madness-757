"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AutoRefreshLeaderboard() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("leaderboard-auto-refresh")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_results",
        },
        () => {
          router.refresh();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
        },
        () => {
          router.refresh();
        }
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}