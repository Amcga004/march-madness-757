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

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-slate-950">{value}</div>
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

  const forecasts: ManagerForecast[] = computeLeagueForecasts({
    members: typedMembers as ForecastMember[],
    picks: typedPicks as ForecastPick[],
    teams: typedTeams as ForecastTeam[],
    teamResults: typedResults as ForecastTeamResult[],
    games: typedGames as ForecastGame[],
  }).sort((a: ManagerForecast, b: ManagerForecast) => {
    if (b.currentPoints !== a.currentPoints) return b.currentPoints - a.currentPoints;
    if (b.liveTeams !== a.liveTeams) return b.liveTeams - a.liveTeams;
    return b.maxFinalPoints - a.maxFinalPoints;
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
    short:
      round === "Round of 64"
        ? "R64"
        : round === "Round of 32"
        ? "R32"
        : round === "Sweet 16"
        ? "S16"
        : round === "Elite Eight"
        ? "E8"
        : round === "Final Four"
        ? "F4"
        : "Title",
    round,
    total,
    completed: typedGames.filter((game) => game.round_name === round).length,
  }));

  const mobileRecentResults = typedGames.slice(0, 3);
  const desktopRecentResults = typedGames.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <section className="mb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Dashboard
            </div>
            <h2 className="mt-1 text-3xl font-bold text-slate-950">League Pulse</h2>
            <p className="mt-1 text-sm text-slate-600">
              Fast view of standings, upside, and latest movement.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            {latestUpdated
              ? `Updated ${new Date(latestUpdated).toLocaleString()}`
              : "No results entered yet"}
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950">League at a Glance</h3>
          <div className="text-xs text-slate-500">10-second read</div>
        </div>

        <div className="space-y-3">
          {forecasts.map((forecast: ManagerForecast, index: number) => (
            <div
              key={forecast.memberId}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="text-sm font-semibold text-slate-500">#{index + 1}</div>
                  <ManagerBadge name={forecast.displayName} />
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Points</div>
                  <div className="text-xl font-bold text-slate-950">
                    {forecast.currentPoints}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                <MiniStat label="Alive" value={forecast.liveTeams} />
                <MiniStat label="Out" value={forecast.eliminatedTeams} />
                <MiniStat label="Upside" value={forecast.remainingUpside} />
                <div className="hidden sm:block">
                  <MiniStat label="Max Final" value={forecast.maxFinalPoints} />
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-500 sm:hidden">
                Max Final {forecast.maxFinalPoints}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-slate-950">Tournament Progress</h3>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {roundProgress.map((round) => (
              <div
                key={round.round}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {round.short}
                </div>
                <div className="mt-1 text-lg font-bold text-slate-950">
                  {round.completed}/{round.total}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-slate-950">Quick Totals</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Results" value={typedGames.length} />
            <MiniStat label="Teams Scored" value={typedResults.filter((r) => r.total_points > 0).length} />
            <MiniStat label="Live Managers" value={forecasts.filter((f) => f.liveTeams > 0).length} />
            <MiniStat label="Picks Made" value={typedPicks.length} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950">Latest Results</h3>
          <div className="text-xs text-slate-500">Most recent games</div>
        </div>

        {typedGames.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No game results recorded yet.
          </div>
        ) : (
          <>
            <div className="space-y-3 sm:hidden">
              {mobileRecentResults.map((game) => (
                <div key={game.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-medium text-slate-500">{game.round_name}</div>
                  <div className="mt-2 flex flex-col gap-2 text-sm font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <TeamLogo teamName={teamMap.get(game.winning_team_id ?? "") ?? "TBD"} size={22} />
                      <span>{teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner"}</span>
                    </div>
                    <div className="text-slate-400">defeated</div>
                    <div className="flex items-center gap-2">
                      <TeamLogo teamName={teamMap.get(game.losing_team_id ?? "") ?? "TBD"} size={22} />
                      <span>{teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden space-y-3 sm:block">
              {desktopRecentResults.map((game) => (
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
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}