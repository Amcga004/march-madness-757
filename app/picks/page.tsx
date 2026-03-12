import { createClient } from "@/lib/supabase/server";

export default async function PicksPage() {
  const supabase = await createClient();

  const { data: picks, error } = await supabase
    .from("picks")
    .select(`
      overall_pick,
      snake_round,
      teams (
        school_name,
        seed,
        region
      ),
      league_members (
        display_name
      )
    `)
    .order("overall_pick", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-bold mb-6">Draft Picks</h1>
        <p className="text-red-600">Error loading picks: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold mb-6">Draft Picks</h1>

      {!picks || picks.length === 0 ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-gray-600">
            No picks have been made yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {picks.map((pick: any) => (
            <div
              key={pick.overall_pick}
              className="rounded-xl border bg-white p-4 shadow-sm flex justify-between"
            >
              <div>
                <div className="font-semibold">Pick #{pick.overall_pick}</div>
                <div className="text-sm text-gray-500">Round {pick.snake_round}</div>
                <div className="text-gray-700 mt-1">
                  {pick.teams?.school_name ?? "No Team Selected"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-500">Owner</div>
                <div className="font-semibold">
                  {pick.league_members?.display_name ?? "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}