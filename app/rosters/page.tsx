import { createClient } from "@/lib/supabase/server";

export default async function RostersPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }, { data: teams }, { data: teamResults }] =
    await Promise.all([
      supabase.from("league_members").select("*").order("draft_slot", { ascending: true }),
      supabase.from("picks").select("*").order("overall_pick", { ascending: true }),
      supabase.from("teams").select("*"),
      supabase.from("team_results").select("*"),
    ]);

  const teamMap = new Map(teams?.map((team) => [team.id, team]) ?? []);
  const resultMap = new Map(teamResults?.map((r) => [r.team_id, r]) ?? []);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h2 className="text-3xl font-bold mb-6">Team Rosters</h2>

      <div className="grid gap-6 xl:grid-cols-2">
        {members?.map((member) => {
          const memberPicks = picks?.filter((p) => p.member_id === member.id) ?? [];

          return (
            <div key={member.id} className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold">{member.display_name}</h3>
              <p className="text-sm text-gray-500 mb-4">Draft Slot {member.draft_slot}</p>

              <div className="space-y-3">
                {memberPicks.map((pick) => {
                  const team = teamMap.get(pick.team_id);
                  const result = resultMap.get(pick.team_id);

                  return (
                    <div key={pick.id} className="border rounded-xl p-3">
<div className="text-lg font-semibold">
                        Pick #{pick.overall_pick} • {team?.school_name}
                      </div>

                      <div className="text-sm text-gray-600">
                        {team?.seed} Seed • {team?.region}
                      </div>

                      <div className="text-sm mt-1">
                        Points: <span className="font-semibold">{result?.total_points ?? 0}</span>
                      </div>

                      <div className="text-sm mt-1">
{result ? (
  result.eliminated ? (
    <span className="text-red-600">Eliminated</span>
  ) : (
    <span className="text-green-600">Still Alive</span>
  )
) : (
  <span className="text-gray-500">No games yet</span>
)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}