import { createClient } from "@/lib/supabase/server";
import ManagerBadge from "../components/ManagerBadge";
import TeamLogo from "../components/TeamLogo";
import TeamStatusBadge from "../components/TeamStatusBadge";
import AutoRefreshStandings from "../components/AutoRefreshStandings";

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

type StandingTeam = {
  teamName: string;
  seed: number | null;
  region: string | null;
  points: number;
  eliminated: boolean | null;
};

type StandingEntry = {
  name: string;
  rank: number;
  totalPoints: number;
  liveTeams: number;
  draftedTeams: number;
  teams: StandingTeam[];
};

function SummaryCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {subtext ? <div className="mt-1 text-sm text-slate-500">{subtext}</div> : null}
    </div>
  );
}

export default async function StandingsPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }, { data: teams }, { data: results }] =
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
    ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedTeams = (teams ?? []) as Team[];
  const typedResults = (results ?? []) as TeamResult[];

  const teamMap = new Map(typedTeams.map((team) => [team.id, team]));
  const resultMap = new Map(typedResults.map((result) => [result.team_id, result]));

  const standings: StandingEntry[] = typedMembers
    .map((member) => {
      const memberPicks = typedPicks.filter((pick) => pick.member_id === member.id);

      const teamsForMember: StandingTeam[] = memberPicks.map((pick) => {
        const team = teamMap.get(pick.team_id);
        const result = resultMap.get(pick.team_id);

        return {
          teamName: team?.school_name ?? "Unknown Team",
          seed: team?.seed ?? null,
          region: team?.region ?? null,
          points: result?.total_points ?? 0,
          eliminated: result?.eliminated ?? null,
        };
      });

      const totalPoints = teamsForMember.reduce((sum, team) => sum + team.points, 0);
      const liveTeams = teamsForMember.filter((team) => team.eliminated === false).length;

      return {
        name: member.display_name,
        rank: 0,
        totalPoints,
        liveTeams,
        draftedTeams: teamsForMember.length,
        teams: teamsForMember.sort((a, b) => b.points - a.points),
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.liveTeams !== a.liveTeams) return b.liveTeams - a.liveTeams;
      return b.draftedTeams - a.draftedTeams;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return (
    <div className="mx-auto max-w-7xl p-6">
      <AutoRefreshStandings />

      <section className="mb-8">
        <h2 className="text-3xl font-bold">Standings</h2>
        <p className="mt-2 text-slate-600">
          Full league rankings, team outcomes, and point totals by manager.
        </p>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Current Leader"
          value={standings[0]?.name ?? "—"}
          subtext={standings[0] ? `${standings[0].totalPoints} points` : undefined}
        />
        <SummaryCard
          title="Most Live Teams"
          value={Math.max(...standings.map((s) => s.liveTeams), 0)}
        />
        <SummaryCard title="Managers Ranked" value={standings.length} />
        <SummaryCard
          title="Total Drafted Teams"
          value={standings.reduce((sum, s) => sum + s.draftedTeams, 0)}
        />
      </section>

      <section className="space-y-6">
        {standings.map((entry) => (
          <div
            key={entry.name}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-medium text-slate-500">
                  Rank #{entry.rank}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-bold">{entry.name}</h3>
                  <ManagerBadge name={entry.name} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Points</div>
                  <div className="mt-1 text-2xl font-bold">{entry.totalPoints}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Live Teams</div>
                  <div className="mt-1 text-2xl font-bold">{entry.liveTeams}</div>
                </div>
                <div className="col-span-2 rounded-xl bg-slate-50 p-4 sm:col-span-1">
                  <div className="text-sm text-slate-500">Drafted</div>
                  <div className="mt-1 text-2xl font-bold">{entry.draftedTeams}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {entry.teams.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No teams drafted yet.
                </div>
              ) : (
                entry.teams.map((team, index) => (
                  <div
                    key={`${entry.name}-${team.teamName}-${index}`}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <TeamLogo teamName={team.teamName} size={30} />
                        <div>
                          <div className="text-base font-semibold">{team.teamName}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {team.seed ? `${team.seed} Seed` : "—"}
                            {team.region ? ` • ${team.region}` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-slate-500">Points</div>
                        <div className="mt-1 text-xl font-bold">{team.points}</div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <TeamStatusBadge isEliminated={team.eliminated} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}