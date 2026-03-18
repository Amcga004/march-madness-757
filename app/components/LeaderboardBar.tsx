import { createClient } from "@/lib/supabase/server";
import AutoRefreshLeaderboard from "./AutoRefreshLeaderboard";

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
};

type Pick = {
  id: string;
  member_id: string;
  team_id: string;
};

type TeamResult = {
  id: string;
  team_id: string;
  total_points: number;
  eliminated: boolean;
};

type LeaderboardEntry = {
  name: string;
  points: number;
  liveTeams: number;
  draftedTeams: number;
};

function getStatusLabel(
  entry: LeaderboardEntry,
  index: number,
  leaderPoints: number
) {
  if (index === 0) return "Leader";
  if (entry.liveTeams === 0) return "At Risk";
  if (leaderPoints - entry.points <= 10) return "Chasing";
  return "Alive";
}

function getPillClasses(index: number, statusLabel: string) {
  if (index === 0) {
    return "border-amber-400/40 bg-amber-500/10 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.10),0_0_18px_rgba(251,191,36,0.10)]";
  }

  if (statusLabel === "Chasing") {
    return "border-blue-500/30 bg-blue-500/10 text-slate-100";
  }

  if (statusLabel === "At Risk") {
    return "border-red-500/30 bg-red-500/10 text-slate-100";
  }

  return "border-slate-700/80 bg-slate-900 text-slate-100";
}

function getStatusBadgeClasses(index: number, statusLabel: string) {
  if (index === 0) {
    return "border-amber-400/40 bg-amber-500/10 text-amber-200";
  }

  if (statusLabel === "Chasing") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  }

  if (statusLabel === "At Risk") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

export default async function LeaderboardBar() {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }, { data: teamResults }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("*")
        .order("draft_slot", { ascending: true }),
      supabase.from("picks").select("*"),
      supabase.from("team_results").select("*"),
    ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedResults = (teamResults ?? []) as TeamResult[];

  const leaderboard = typedMembers
    .map((member) => {
      const memberPicks = typedPicks.filter((pick) => pick.member_id === member.id);
      const memberResults = memberPicks.map((pick) =>
        typedResults.find((result) => result.team_id === pick.team_id)
      );

      const totalPoints = memberResults.reduce(
        (sum, result) => sum + (result?.total_points ?? 0),
        0
      );

      const liveTeams = memberResults.filter(
        (result) => result && result.eliminated === false
      ).length;

      return {
        name: member.display_name,
        points: totalPoints,
        liveTeams,
        draftedTeams: memberPicks.length,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.liveTeams !== a.liveTeams) return b.liveTeams - a.liveTeams;
      return b.draftedTeams - a.draftedTeams;
    });

  const leaderPoints = leaderboard[0]?.points ?? 0;

  return (
    <div className="border-b border-slate-800/80 bg-[#020817]/95 text-white">
      <AutoRefreshLeaderboard />

      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Live Leaderboard
          </span>

          <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
            {leaderboard.map((entry, index) => {
              const statusLabel = getStatusLabel(entry, index, leaderPoints);

              return (
                <div
                  key={entry.name}
                  className={`shrink-0 rounded-2xl border px-3 py-2 ${getPillClasses(
                    index,
                    statusLabel
                  )}`}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-sm font-extrabold">
                      #{index + 1} {entry.name}
                    </span>

                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusBadgeClasses(
                        index,
                        statusLabel
                      )}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
                    <span className="font-semibold text-white">{entry.points} pts</span>

                    <span className="text-slate-500">•</span>

                    <span className="text-slate-300">{entry.liveTeams} alive</span>

                    <span className="hidden text-slate-500 sm:inline">•</span>

                    <span className="hidden text-slate-400 sm:inline">
                      {entry.draftedTeams} drafted
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}