type TeamLogoProps = {
  teamName: string;
  size?: number;
};

import { getCanonicalTeamName, getTeamLogoDomain } from "@/lib/teamIdentity";

export default function TeamLogo({ teamName, size = 24 }: TeamLogoProps) {
  const canonical = getCanonicalTeamName(teamName);
  const domain = getTeamLogoDomain(canonical);

  if (!domain) {
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
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
      }}
    />
  );
}