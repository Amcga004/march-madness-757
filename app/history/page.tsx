import { createClient } from "@/lib/supabase/server";

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  status: string | null;
  created_at: string;
};

type Team = {
  id: string;
  school_name: string;
};

export default async function HistoryPage() {
  const supabase = await createClient();

  const [{ data: games, error: gamesError }, { data: teams, error: teamsError }] =
    await Promise.all([
      supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("teams")
        .select("id, school_name"),
    ]);

  const error = gamesError || teamsError;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-bold">Results History</h1>
        <p className="mt-4 text-red-600">Error loading history: {error.message}</p>
      </main>
    );
  }

  const teamMap = new Map((teams as Team[]).map((team) => [team.id, team.school_name]));

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Results History</h1>
        <p className="mt-2 text-gray-600">
          Every recorded game result entered into the app.
        </p>
      </div>

      <div className="space-y-4">
        {(games as Game[]).length === 0 ? (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            No game results recorded yet.
          </div>
        ) : (
          (games as Game[]).map((game) => (
            <div key={game.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="text-sm text-gray-500">{game.round_name}</div>
              <div className="mt-1 font-semibold">
                {teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner"} defeated{" "}
                {teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser"}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Status: {game.status ?? "unknown"}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {new Date(game.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}