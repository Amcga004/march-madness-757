import { createClient } from "@/lib/supabase/server";

type Member = {
  id: string;
  display_name: string;
  role: string;
  draft_slot: number;
};

type Pick = {
  id: string;
  member_id: string;
  team_id: string;
  overall_pick: number;
};

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type TeamResult = {
  id: string;
  team_id: string;
  total_points: number;
  eliminated: boolean;
};

export default async function StandingsPage() {
  const supabase = await createClient();

  const [
    { data: members, error: membersError },
    { data: picks, error: picksError },
    { data: teams, error: teamsError },
    { data: teamResults, error: resultsError },
  ] = await Promise.all([
    supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
    supabase.from("picks").select("*").order("overall_pick", { ascending: true }),
    supabase.from("teams").select("*"),
    supabase.from("team_results").select("*"),
  ]);

  const error = membersError || picksError || teamsError || resultsError;

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-8">
        <h1 className="text-3xl font-bold">Standings</h1>
        <p className="mt-4 text-red-600">Error loading standings: {error.message}</p>
      </main>
    );
  }

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedTeams = (teams ?? []) as Team[];
  const typedResults = (teamResults ?? []) as TeamResult[];

  const standings = typedMembers.map((member) => {
    const memberPicks = typedPicks.filter((pick) => pick.member_id === member.id);

    const roster = memberPicks.map((pick) => {
      const team = typedTeams.find((t) => t.id === pick.team_id);
      const result = typedResults.find((r) => r.team_id === pick.team_id);

      return {
        overallPick: pick.overall_pick,
        teamName: team?.school_name ?? "Unknown Team",
        seed: team?.seed ?? null,
        region: team?.region ?? "",
        totalPoints: result?.total_points ?? 0,
        eliminated: result?.eliminated ?? false,
      };
    });

    const totalPoints = roster.reduce((sum, team) => sum + team.totalPoints, 0);
    const draftedTeams = roster.length;
    const liveTeams = roster.filter((team) => !team.eliminated).length;
    const totalWins = roster.filter((team) => team.totalPoints > 0).length;

    return {
      name: member.display_name,
      draftedTeams,
      liveTeams,
      totalPoints,
      totalWins,
      roster,
    };
  });

  const sortedStandings = standings.sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Standings</h1>
        <p className="mt-2 text-gray-600">
          Live leaderboard with current roster status for each player.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {sortedStandings.map((entry, index) => (
          <section key={entry.name} className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-gray-500">Rank #{index + 1}</div>
                <h2 className="mt-1 text-2xl font-bold">{entry.name}</h2>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Points</div>
                <div className="text-2xl font-bold">{entry.totalPoints}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Drafted Teams</div>
                <div className="mt-1 font-semibold">{entry.draftedTeams}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Live Teams</div>
                <div className="mt-1 font-semibold">{entry.liveTeams}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-gray-500">Wins</div>
                <div className="mt-1 font-semibold">{entry.totalWins}</div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="mb-3 text-lg font-semibold">Roster</h3>

              {entry.roster.length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-gray-600">
                  No teams drafted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {entry.roster.map((team) => (
                    <div
                      key={`${entry.name}-${team.overallPick}`}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold">
                            Pick #{team.overallPick} • {team.teamName}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {team.seed ? `${team.seed} Seed • ` : ""}
                            {team.region}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-gray-500">Team Points</div>
                          <div className="font-semibold">{team.totalPoints}</div>
                        </div>
                      </div>

                      <div className="mt-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 ${
                            team.eliminated
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {team.eliminated ? "Eliminated" : "Still Alive"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}