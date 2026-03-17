import { createClient } from "@/lib/supabase/server";
import ManagerBadge from "./components/ManagerBadge";
import TeamLogo from "./components/TeamLogo";
import {
  computeLeagueForecasts,
  type ForecastGame,
  type ForecastMember,
  type ForecastPick,
  type ForecastTeam,
  type ForecastTeamResult,
  type ManagerForecast,
} from "@/lib/bracketForecast";

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
  seed: number;
  region: string;
};

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }, { data: teamResults }, { data: games }, { data: teams }] =
    await Promise.all([
      supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
      supabase.from("picks").select("*").order("overall_pick", { ascending: true }),
      supabase.from("team_results").select("*"),
      supabase.from("games").select("*").order("created_at", { ascending: false }).limit(12),
      supabase.from("teams").select("id, school_name, seed, region"),
    ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedResults = (teamResults ?? []) as TeamResult[];
  const typedGames = (games ?? []) as Game[];
  const typedTeams = (teams ?? []) as Team[];

  const teamMap = new Map<string, string>(typedTeams.map((team) => [team.id, team.school_name]));
  const latestUpdated = typedGames[0]?.created_at ?? null;

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
    .slice(-6)
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

  const roundTargets: Record<string, number> = {
    "Round of 64": 32,
    "Round of 32": 16,
    "Sweet 16": 8,
    "Elite Eight": 4,
    "Final Four": 2,
    Championship: 1,
  };

  const roundProgress = Object.entries(roundTargets).map(([round, total]) => ({
    round,
    total,
    completed: typedGames.filter((game) => game.round_name === round).length,
  }));

  const forecasts: ManagerForecast[] = computeLeagueForecasts({
    members: typedMembers as ForecastMember[],
    picks: typedPicks as ForecastPick[],
    teams: typedTeams as ForecastTeam[],
    teamResults: typedResults as ForecastTeamResult[],
    games: typedGames as ForecastGame[],
  }).sort((a: ManagerForecast, b: ManagerForecast) => {
    if (b.currentPoints !== a.currentPoints) return b.currentPoints - a.currentPoints;
    return b.maxFinalPoints - a.maxFinalPoints;
  });

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <section className="mb-5 sm:mb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Dashboard
        </div>
        <h2 className="mt-1 text-3xl font-bold text-slate-950">League Command Center</h2>
        <p className="mt-2 text-slate-600">
          Live standings, round progress, latest results, and bracket-constrained roster outlook.
        </p>
      </section>

      <section className="mb-6 grid gap-4 sm:mb-8 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Picks Made" value={typedPicks.length} />
        <StatCard title="Results Recorded" value={typedGames.length} />
        <StatCard
          title="Teams With Points"
          value={typedResults.filter((result) => result.total_points > 0).length}
        />
        <StatCard
          title="Managers With Live Teams"
          value={standings.filter((entry) => entry.liveTeams > 0).length}
        />
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">League Outlook</h3>
            <p className="mt-1 text-sm text-slate-600">
              Bracket-constrained ceiling based on valid remaining tournament paths.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            {latestUpdated
              ? `Last result entered: ${new Date(latestUpdated).toLocaleString()}`
              : "No results entered yet"}
          </div>
        </div>

        <div className="space-y-3">
          {forecasts.map((forecast: ManagerForecast, index: number) => (
            <div
              key={forecast.memberId}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-slate-500">Rank #{index + 1}</div>
                  <ManagerBadge name={forecast.displayName} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-lg bg-white p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Current
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.currentPoints}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Live Teams
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.liveTeams}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Eliminated
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.eliminatedTeams}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Remaining Upside
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.remainingUpside}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Max Final
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.maxFinalPoints}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-slate-950">Round Progress</h3>
          <p className="mt-1 text-sm text-slate-600">
            Current tournament completion by round.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roundProgress.map((round) => {
            const percent =
              round.total > 0 ? Math.min(100, Math.round((round.completed / round.total) * 100)) : 0;

            return (
              <div
                key={round.round}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-sm font-medium text-slate-500">{round.round}</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-extrabold text-slate-950">
                    {round.completed}/{round.total}
                  </div>
                  <div className="text-sm font-medium text-slate-600">{percent}%</div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6 sm:mb-8">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-2xl font-bold">Current Standings</h3>
          <div className="text-sm text-slate-500">
            {latestUpdated
              ? `Last result entered: ${new Date(latestUpdated).toLocaleString()}`
              : "No results entered yet"}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {standings.map((entry, index) => (
            <div
              key={entry.name}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-500">Rank #{index + 1}</div>
                <ManagerBadge name={entry.name} />
              </div>

              <div className="mt-4 text-3xl font-extrabold tracking-tight">
                {entry.points}
              </div>
              <div className="text-sm text-slate-500">points</div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">Live Teams</div>
                  <div className="mt-1 font-semibold">{entry.liveTeams}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-slate-500">Drafted</div>
                  <div className="mt-1 font-semibold">{entry.draftedTeams}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-bold">Recent Results</h3>

            <div className="mt-4 space-y-3">
              {typedGames.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No game results recorded yet.
                </div>
              ) : (
                typedGames.slice(0, 6).map((game) => (
                  <div key={game.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">{game.round_name}</div>
                    <div className="mt-2 flex flex-col gap-2 text-base font-semibold text-slate-900 sm:flex-row sm:flex-wrap sm:items-center">
                      <div className="flex items-center gap-2">
                        <TeamLogo teamName={teamMap.get(game.winning_team_id ?? "") ?? "TBD"} size={24} />
                        <span>{teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner"}</span>
                      </div>
                      <span className="text-slate-400">defeated</span>
                      <div className="flex items-center gap-2">
                        <TeamLogo teamName={teamMap.get(game.losing_team_id ?? "") ?? "TBD"} size={24} />
                        <span>{teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser"}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {new Date(game.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-bold">Recent Picks</h3>

            <div className="mt-4 space-y-3">
              {recentPicks.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No picks made yet.
                </div>
              ) : (
                recentPicks.map((pick) => (
                  <div key={pick.overallPick} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <TeamLogo teamName={pick.teamName} size={28} />
                        <div>
                          <div className="text-sm font-medium text-slate-500">
                            Pick #{pick.overallPick}
                          </div>
                          <div className="mt-1 text-base font-semibold">{pick.teamName}</div>
                        </div>
                      </div>
                      <ManagerBadge name={pick.manager} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-xl font-bold">League Snapshot</h3>

          <div className="mt-5 space-y-4">
            {standings.map((entry) => (
              <div
                key={entry.name}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <ManagerBadge name={entry.name} />
                  <div className="text-sm text-slate-500">
                    {entry.liveTeams} alive • {entry.draftedTeams} drafted
                  </div>
                </div>

                <div className="text-lg font-bold">{entry.points}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}