"use client";

import { useState } from "react";
import { getCanonicalTeamName, getTeamLogoDomain } from "@/lib/teamIdentity";

type TeamLogoProps = {
  teamName: string;
  size?: number;
};

export default function TeamLogo({ teamName, size = 24 }: TeamLogoProps) {
  const canonical = getCanonicalTeamName(teamName);
  const domain = getTeamLogoDomain(canonical);
  const [hasError, setHasError] = useState(false);

  if (!domain || hasError) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600"
        style={{ width: size, height: size }}
      >
        🏀
      </div>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={`${canonical} logo`}
      width={size}
      height={size}
      className="rounded-full border border-slate-200 bg-white object-cover"
      onError={() => {
        setHasError(true);
      }}
    />
  );
}