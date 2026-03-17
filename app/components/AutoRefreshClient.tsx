"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshClientProps = {
  intervalMs?: number;
};

export default function AutoRefreshClient({
  intervalMs = 60000,
}: AutoRefreshClientProps) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [router, intervalMs]);

  return null;
}