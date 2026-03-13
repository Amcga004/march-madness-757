import { createClient } from "@/lib/supabase/server";
import ManagerBadge from "./components/ManagerBadge";

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

function StatCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: number;
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

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }, { data: teamResults }, { data: games }, { data: teams }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("*")
        .order("draft_slot", { ascending: true }),
      supabase
        .from("picks")
        .select("*")
        .order("overall_pick", { ascending: true }),
      supabase.from("team_results").select("*"),
      supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
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

  return (
    <div className="mx-auto max-w-7xl p-6">
      <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Live Competition Hub
            </div>
            <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950">
              757 March Madness Snake Draft
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Follow live standings, track roster performance, monitor the bracket,
              and see every result as the tournament unfolds.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              League Motto
            </div>
            <div className="mt-1 text-lg font-semibold">
              Survive and advance
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <section className="mb-8">
        <h3 className="mb-4 text-2xl font-bold">Current Standings</h3>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {standings.map((entry, index) => (
            <div
              key={entry.name}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold">Recent Results</h3>

            <div className="mt-4 space-y-3">
              {typedGames.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No game results recorded yet.
                </div>
              ) : (
                typedGames.map((game) => (
                  <div key={game.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="text-sm font-medium text-slate-500">{game.round_name}</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">
                      {teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner"} defeated{" "}
                      {teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {new Date(game.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold">Recent Picks</h3>

            <div className="mt-4 space-y-3">
              {recentPicks.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No picks made yet.
                </div>
              ) : (
                recentPicks.map((pick) => (
                  <div key={pick.overallPick} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-slate-500">
                          Pick #{pick.overallPick}
                        </div>
                        <div className="mt-1 text-base font-semibold">{pick.teamName}</div>
                      </div>
                      <ManagerBadge name={pick.manager} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">League Snapshot</h3>

          <div className="mt-5 space-y-4">
            {standings.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
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