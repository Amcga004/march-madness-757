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

  const [
    { data: members },
    { data: picks },
    { data: teamResults },
  ] = await Promise.all([
    supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
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
    <div className="border-b bg-slate-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-slate-300">Live Leaderboard:</span>

          {leaderboard.map((entry, index) => (
            <div
              key={entry.name}
              className="rounded-full bg-slate-800 px-3 py-1"
            >
              <span className="font-semibold">
                #{index + 1} {entry.name}
              </span>
              <span className="ml-2 text-slate-300">
                {entry.points} pts • {entry.liveTeams} alive • {entry.draftedTeams} drafted
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}