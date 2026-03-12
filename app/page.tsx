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
  overall_pick: number;
};

type TeamResult = {
  id: string;
  team_id: string;
  total_points: number;
  eliminated: boolean;
};

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  created_at: string;
};

type Team = {
  id: string;
  school_name: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: members },
    { data: picks },
    { data: teamResults },
    { data: games },
    { data: teams },
  ] = await Promise.all([
    supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
    supabase.from("picks").select("*").order("overall_pick", { ascending: true }),
    supabase.from("team_results").select("*"),
    supabase.from("games").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("teams").select("id, school_name"),
  ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedResults = (teamResults ?? []) as TeamResult[];
  const typedGames = (games ?? []) as Game[];
  const typedTeams = (teams ?? []) as Team[];

  const teamMap = new Map(typedTeams.map((team) => [team.id, team.school_name]));

  const standings = typedMembers
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

  const recentPicks = typedPicks
    .slice(-5)
    .reverse()
    .map((pick) => {
      const member = typedMembers.find((m) => m.id === pick.member_id);
      const teamName = teamMap.get(pick.team_id) ?? "Unknown Team";

      return {
        overallPick: pick.overall_pick,
        manager: member?.display_name ?? "Unknown",
        teamName,
      };
    });

  return (
    <div className="mx-auto max-w-7xl p-6">
      <section className="mb-8">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="mt-2 text-gray-600">
          Current league standings and recent tournament activity.
        </p>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {standings.map((entry, index) => (
          <div key={entry.name} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">Rank #{index + 1}</div>
            <div className="mt-1 text-2xl font-bold">{entry.name}</div>
            <div className="mt-4 space-y-2 text-sm">
              <div>Points: <span className="font-semibold">{entry.points}</span></div>
              <div>Live Teams: <span className="font-semibold">{entry.liveTeams}</span></div>
              <div>Drafted Teams: <span className="font-semibold">{entry.draftedTeams}</span></div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Recent Results</h3>

            <div className="mt-4 space-y-3">
              {typedGames.length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-gray-600">
                  No game results recorded yet.
                </div>
              ) : (
                typedGames.map((game) => (
                  <div key={game.id} className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">{game.round_name}</div>
                    <div className="mt-1 font-semibold">
                      {teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner"} defeated{" "}
                      {teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser"}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {new Date(game.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Recent Picks</h3>

            <div className="mt-4 space-y-3">
              {recentPicks.length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-gray-600">
                  No picks made yet.
                </div>
              ) : (
                recentPicks.map((pick) => (
                  <div key={pick.overallPick} className="rounded-xl border p-4">
                    <div className="text-sm text-gray-500">Pick #{pick.overallPick}</div>
                    <div className="mt-1 font-semibold">{pick.manager}</div>
                    <div className="mt-1 text-sm text-gray-600">{pick.teamName}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">League Snapshot</h3>

          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border p-4">
              <div className="text-gray-500">Total Picks Made</div>
              <div className="mt-1 text-2xl font-bold">{typedPicks.length}</div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-gray-500">Results Recorded</div>
              <div className="mt-1 text-2xl font-bold">{typedGames.length}</div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-gray-500">Teams with Points</div>
              <div className="mt-1 text-2xl font-bold">
                {typedResults.filter((result) => result.total_points > 0).length}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-gray-500">Managers with Live Teams</div>
              <div className="mt-1 text-2xl font-bold">
                {standings.filter((entry) => entry.liveTeams > 0).length}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}