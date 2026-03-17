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

  const latestUpdated = typedGames[0]?.created_at ?? null;

  const forecasts: ManagerForecast[] = computeLeagueForecasts({
    members: typedMembers as ForecastMember[],
    picks: typedPicks as ForecastPick[],
    teams: typedTeams as ForecastTeam[],
    teamResults: typedResults as ForecastTeamResult[],
    games: typedGames as ForecastGame[],
  });

  const forecastMap = new Map<string, ManagerForecast>(
    forecasts.map((forecast) => [forecast.memberId, forecast])
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <section className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Rosters
            </div>
            <h2 className="mt-1 text-3xl font-bold">Team Rosters</h2>
            <p className="mt-2 text-slate-600">
              Every manager’s drafted teams, current output, and remaining bracket-constrained upside.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            {latestUpdated
              ? `Last updated: ${new Date(latestUpdated).toLocaleString()}`
              : "No results entered yet"}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {typedMembers.map((member) => {
          const memberPicks = typedPicks.filter((pick) => pick.member_id === member.id);
          const forecast = forecastMap.get(member.id);

          return (
            <div
              key={member.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{member.display_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Draft Slot {member.draft_slot}
                  </p>
                </div>
                <div className="self-start sm:self-auto">
                  <ManagerBadge name={member.display_name} />
                </div>
              </div>

              {forecast ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Current
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.currentPoints}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Live Teams
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.liveTeams}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Eliminated
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.eliminatedTeams}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Upside
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.remainingUpside}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Max Final
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {forecast.maxFinalPoints}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {memberPicks.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No teams drafted yet.
                  </div>
                ) : (
                  memberPicks.map((pick) => {
                    const team = typedTeams.find((t) => t.id === pick.team_id);
                    const result = typedResults.find((r) => r.team_id === pick.team_id);

                    return (
                      <div
                        key={pick.id}
                        className="rounded-xl border border-slate-200 p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <TeamLogo teamName={team?.school_name ?? "TBD"} size={32} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-500">
                                Pick #{pick.overall_pick}
                              </div>
                              <div className="mt-1 text-base font-semibold sm:text-lg">
                                {team?.school_name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {team?.seed ? `${team.seed} Seed` : "—"}
                                {team?.region ? ` • ${team.region}` : ""}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:block sm:text-right">
                            <div className="text-sm text-slate-500">Points</div>
                            <div className="mt-1 text-xl font-bold">
                              {result?.total_points ?? 0}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <TeamStatusBadge
                            isEliminated={result ? result.eliminated : null}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}