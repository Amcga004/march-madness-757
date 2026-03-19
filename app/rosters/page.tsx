import { createClient } from "@/lib/supabase/server";
import ManagerBadge from "../components/ManagerBadge";
import TeamLogo from "../components/TeamLogo";
import TeamStatusBadge from "../components/TeamStatusBadge";
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

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  created_at: string;
};

function formatEasternDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-white">{value}</div>
    </div>
  );
}

type RosterEntry = {
  pick: Pick;
  team: Team | undefined;
  result: TeamResult | undefined;
};

function sortRosterEntries(entries: RosterEntry[]) {
  return [...entries].sort((a, b) => {
    const aEliminated = a.result?.eliminated ?? false;
    const bEliminated = b.result?.eliminated ?? false;

    if (aEliminated !== bEliminated) {
      return aEliminated ? 1 : -1;
    }

    const aPoints = a.result?.total_points ?? 0;
    const bPoints = b.result?.total_points ?? 0;

    if (bPoints !== aPoints) {
      return bPoints - aPoints;
    }

    return a.pick.overall_pick - b.pick.overall_pick;
  });
}

export default async function RostersPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }, { data: teams }, { data: teamResults }, { data: games }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("*")
        .order("draft_slot", { ascending: true }),
      supabase
        .from("picks")
        .select("*")
        .order("overall_pick", { ascending: true }),
      supabase.from("teams").select("*"),
      supabase.from("team_results").select("*"),
      supabase
        .from("games")
        .select("id, round_name, winning_team_id, losing_team_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedTeams = (teams ?? []) as Team[];
  const typedResults = (teamResults ?? []) as TeamResult[];
  const typedGames = (games ?? []) as Game[];

  const latestRecordedResultAt = typedGames[0]?.created_at ?? null;

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

  const forecastMap = new Map<string, ManagerForecast>(
    forecasts.map((forecast) => [forecast.memberId, forecast])
  );

  const rankMap = new Map<string, number>(
    forecasts.map((forecast, index) => [forecast.memberId, index + 1])
  );

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
      <section className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Rosters
              </div>
              <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                League Rosters
              </h2>
            </div>

            <div className="text-right text-[10px] text-slate-400 sm:text-xs">
              {latestRecordedResultAt
                ? `Updated ${formatEasternDateTime(latestRecordedResultAt)}`
                : "No results recorded yet"}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {typedMembers.map((member, memberIndex) => {
          const memberPicks = typedPicks.filter((pick) => pick.member_id === member.id);
          const forecast = forecastMap.get(member.id);
          const rank = rankMap.get(member.id);

          const rosterEntries = sortRosterEntries(
            memberPicks.map((pick) => ({
              pick,
              team: typedTeams.find((t) => t.id === pick.team_id),
              result: typedResults.find((r) => r.team_id === pick.team_id),
            }))
          );

          const defaultOpen = memberIndex === 0;

          return (
            <details
              key={member.id}
              open={defaultOpen}
              className="group rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-400">
                      #{rank ?? "—"}
                    </div>
                    <ManagerBadge name={member.display_name} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
                    <span>{forecast?.currentPoints ?? 0} pts</span>
                    <span>{forecast?.liveTeams ?? 0} alive</span>
                    <span>{forecast?.eliminatedTeams ?? 0} out</span>
                    <span>Draft Slot {member.draft_slot}</span>
                  </div>
                </div>

                <div className="shrink-0 text-slate-300 transition-transform duration-200 group-open:rotate-180">
                  ▼
                </div>
              </summary>

              {forecast ? (
                <div className="mt-4 grid gap-2 grid-cols-2 sm:grid-cols-5">
                  <StatTile label="Current" value={forecast.currentPoints} />
                  <StatTile label="Alive" value={forecast.liveTeams} />
                  <StatTile label="Out" value={forecast.eliminatedTeams} />
                  <StatTile label="Upside" value={forecast.remainingUpside} />
                  <StatTile label="Max Final" value={forecast.maxFinalPoints} />
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {rosterEntries.length === 0 ? (
                  <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4 text-sm text-slate-400">
                    No teams drafted yet.
                  </div>
                ) : (
                  rosterEntries.map(({ pick, team, result }) => (
                    <div
                      key={pick.id}
                      className="rounded-2xl border border-slate-700/80 bg-[#172033] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <TeamLogo teamName={team?.school_name ?? "TBD"} size={28} />
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                              Pick #{pick.overall_pick}
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-white sm:text-base">
                              {team?.school_name ?? "TBD"}
                            </div>
                            <div className="mt-1 text-xs text-slate-400 sm:text-sm">
                              {team?.seed ? `${team.seed} Seed` : "—"}
                              {team?.region ? ` • ${team.region}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                            Points
                          </div>
                          <div className="mt-1 text-lg font-bold text-white">
                            {result?.total_points ?? 0}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <TeamStatusBadge
                          isEliminated={result ? result.eliminated : null}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}