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
  external_game_id: string | null;
  status?: string | null;
};

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type ExternalGameSync = {
  external_game_id: string;
  home_score: number | null;
  away_score: number | null;
  espn_status: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
};

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-white">{value}</div>
    </div>
  );
}

function getDisplayStatus(status: string | null | undefined) {
  if (!status) return "Final";
  if (status === "STATUS_FINAL" || status === "complete") return "Final";
  return status.replace("STATUS_", "").replaceAll("_", " ").trim();
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { data: members },
    { data: picks },
    { data: teamResults },
    { data: games },
    { data: teams },
    { data: externalGames },
  ] = await Promise.all([
    supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
    supabase.from("picks").select("*").order("overall_pick", { ascending: true }),
    supabase.from("team_results").select("*"),
    supabase
      .from("games")
      .select("id, round_name, winning_team_id, losing_team_id, created_at, external_game_id, status")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("teams").select("id, school_name, seed, region"),
    supabase
      .from("external_game_sync")
      .select(
        "external_game_id, home_score, away_score, espn_status, home_team_name, away_team_name, mapped_home_team_id, mapped_away_team_id"
      ),
  ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedResults = (teamResults ?? []) as TeamResult[];
  const typedGames = (games ?? []) as Game[];
  const typedTeams = (teams ?? []) as Team[];
  const typedExternalGames = (externalGames ?? []) as ExternalGameSync[];

  const teamMap = new Map<string, string>(typedTeams.map((team) => [team.id, team.school_name]));
  const externalGameMap = new Map<string, ExternalGameSync>(
    typedExternalGames.map((game) => [game.external_game_id, game])
  );

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

  const mobileRecentResults = typedGames.slice(0, 4);
  const desktopRecentResults = typedGames.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <section className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Dashboard
            </div>
            <h2 className="mt-1 text-3xl font-bold text-white sm:text-4xl">
              League Pulse
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Fast view of standings, upside, and latest movement.
            </p>
          </div>

          <div className="text-sm text-slate-400">
            {latestUpdated
              ? `Updated ${new Date(latestUpdated).toLocaleString()}`
              : "No results entered yet"}
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">League at a Glance</h3>
          <div className="text-xs text-slate-400">10-second read</div>
        </div>

        <div className="space-y-3">
          {forecasts.map((forecast: ManagerForecast, index: number) => (
            <div
              key={forecast.memberId}
              className="rounded-3xl border border-slate-700/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(23,32,51,0.96))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="text-sm font-semibold text-slate-400">#{index + 1}</div>
                  <ManagerBadge name={forecast.displayName} />
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Points</div>
                  <div className="text-xl font-bold text-white">
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

              <div className="mt-2 text-xs text-slate-400 sm:hidden">
                Max Final {forecast.maxFinalPoints}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-white">Tournament Progress</h3>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {roundProgress.map((round) => (
              <div
                key={round.round}
                className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-3 text-center"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {round.short}
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  {round.completed}/{round.total}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-white">Quick Totals</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Results" value={typedGames.length} />
            <MiniStat label="Teams Scored" value={typedResults.filter((r) => r.total_points > 0).length} />
            <MiniStat label="Live Managers" value={forecasts.filter((f) => f.liveTeams > 0).length} />
            <MiniStat label="Picks Made" value={typedPicks.length} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Latest Results</h3>
          <div className="text-xs text-slate-400">Most recent games</div>
        </div>

        {typedGames.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4 text-sm text-slate-400">
            No game results recorded yet.
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:hidden">
              {mobileRecentResults.map((game) => {
                const externalGame =
                  game.external_game_id ? externalGameMap.get(game.external_game_id) ?? null : null;

                const homeName =
                  externalGame?.mapped_home_team_id
                    ? teamMap.get(externalGame.mapped_home_team_id) ??
                      externalGame.home_team_name ??
                      "Home"
                    : externalGame?.home_team_name ??
                      teamMap.get(game.winning_team_id ?? "") ??
                      "Home";

                const awayName =
                  externalGame?.mapped_away_team_id
                    ? teamMap.get(externalGame.mapped_away_team_id) ??
                      externalGame.away_team_name ??
                      "Away"
                    : externalGame?.away_team_name ??
                      teamMap.get(game.losing_team_id ?? "") ??
                      "Away";

                const homeScore = externalGame?.home_score ?? null;
                const awayScore = externalGame?.away_score ?? null;
                const statusLabel = getDisplayStatus(externalGame?.espn_status ?? game.status);

                return (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-2"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {game.round_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{statusLabel}</div>
                    </div>

                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo teamName={homeName} size={18} />
                          <span className="truncate text-sm font-semibold text-white">
                            {homeName}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {homeScore ?? "—"}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo teamName={awayName} size={18} />
                          <span className="truncate text-sm font-semibold text-white">
                            {awayName}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {awayScore ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-3">
              {desktopRecentResults.map((game) => {
                const externalGame =
                  game.external_game_id ? externalGameMap.get(game.external_game_id) ?? null : null;

                const homeName =
                  externalGame?.mapped_home_team_id
                    ? teamMap.get(externalGame.mapped_home_team_id) ??
                      externalGame.home_team_name ??
                      "Home"
                    : externalGame?.home_team_name ??
                      teamMap.get(game.winning_team_id ?? "") ??
                      "Home";

                const awayName =
                  externalGame?.mapped_away_team_id
                    ? teamMap.get(externalGame.mapped_away_team_id) ??
                      externalGame.away_team_name ??
                      "Away"
                    : externalGame?.away_team_name ??
                      teamMap.get(game.losing_team_id ?? "") ??
                      "Away";

                const homeScore = externalGame?.home_score ?? null;
                const awayScore = externalGame?.away_score ?? null;
                const statusLabel = getDisplayStatus(externalGame?.espn_status ?? game.status);

                return (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-slate-700/80 bg-[#172033] px-3 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {game.round_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{statusLabel}</div>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo teamName={homeName} size={18} />
                          <span className="truncate text-sm font-semibold text-white">
                            {homeName}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {homeScore ?? "—"}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamLogo teamName={awayName} size={18} />
                          <span className="truncate text-sm font-semibold text-white">
                            {awayName}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {awayScore ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}