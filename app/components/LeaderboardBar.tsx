import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Live Leaderboard
          </span>

          <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.name}
                className="shrink-0 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="font-semibold text-white">
                    #{index + 1} {entry.name}
                  </span>

                  <span className="text-slate-400">{entry.points} pts</span>

                  <span className="hidden text-slate-500 sm:inline">•</span>

                  <span className="hidden text-slate-400 sm:inline">
                    {entry.liveTeams} alive
                  </span>

                  <span className="hidden text-slate-500 sm:inline">•</span>

                  <span className="hidden text-slate-400 sm:inline">
                    {entry.draftedTeams} drafted
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}