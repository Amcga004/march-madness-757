"use client";

import { usePathname } from "next/navigation";

export default function HideOnScores({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/scores") {
    return null;
  }

  return <>{children}</>;
}