import { createClient } from "@/lib/supabase/server";
import ManagerBadge from "../components/ManagerBadge";
import TeamLogo from "../components/TeamLogo";

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

export default async function RostersPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }, { data: teams }, { data: teamResults }] =
    await Promise.all([
      supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
      supabase.from("picks").select("*").order("overall_pick", { ascending: true }),
      supabase.from("teams").select("*"),
      supabase.from("team_results").select("*"),
    ]);

  const typedMembers = (members ?? []) as Member[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedTeams = (teams ?? []) as Team[];
  const typedResults = (teamResults ?? []) as TeamResult[];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <section className="mb-8">
        <h2 className="text-3xl font-bold">Team Rosters</h2>
        <p className="mt-2 text-slate-600">
          Every manager’s drafted teams, point totals, and survival status.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {typedMembers.map((member) => {
          const memberPicks = typedPicks.filter((p) => p.member_id === member.id);

          return (
            <div
              key={member.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold">{member.display_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">Draft Slot {member.draft_slot}</p>
                </div>
                <ManagerBadge name={member.display_name} />
              </div>

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
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <TeamLogo teamName={team?.school_name ?? "TBD"} size={30} />
                            <div>
                              <div className="text-sm font-medium text-slate-500">
                                Pick #{pick.overall_pick}
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {team?.school_name}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {team?.seed} Seed • {team?.region}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm text-slate-500">Points</div>
                            <div className="mt-1 text-xl font-bold">
                              {result?.total_points ?? 0}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4">
                          {result ? (
                            result.eliminated ? (
                              <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                                Eliminated
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-green-300 bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                                Still Alive
                              </span>
                            )
                          ) : (
                            <span className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
                              No games yet
                            </span>
                          )}
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