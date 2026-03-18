import { createClient } from "@/lib/supabase/server";
import TeamLogo from "../components/TeamLogo";

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
      supabase.from("teams").select("id, school_name"),
    ]);

  const error = gamesError || teamsError;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-bold text-white">Results History</h1>
        <p className="mt-4 text-red-300">Error loading history: {error.message}</p>
      </main>
    );
  }

  const teamMap = new Map((teams as Team[]).map((team) => [team.id, team.school_name]));
  const typedGames = (games ?? []) as Game[];
  const latestUpdated = typedGames[0]?.created_at ?? null;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Results
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">Results History</h1>
          <p className="mt-2 text-slate-300">
            Every recorded game result entered into the app.
          </p>
        </div>

        <div className="text-sm text-slate-400">
          {latestUpdated
            ? `Last updated: ${new Date(latestUpdated).toLocaleString()}`
            : "No game results recorded yet"}
        </div>
      </div>

      <div className="space-y-4">
        {typedGames.length === 0 ? (
          <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 text-slate-400 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            No game results recorded yet.
          </div>
        ) : (
          typedGames.map((game) => {
            const winnerName = teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner";
            const loserName = teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser";

            return (
              <div
                key={game.id}
                className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-400">{game.round_name}</div>
                  <div className="text-sm text-slate-400">
                    {new Date(game.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 text-base font-semibold text-white sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex items-center gap-2">
                    <TeamLogo teamName={winnerName} size={26} />
                    <span>{winnerName}</span>
                  </div>

                  <span className="text-slate-500">defeated</span>

                  <div className="flex items-center gap-2">
                    <TeamLogo teamName={loserName} size={26} />
                    <span>{loserName}</span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-300">
                  Status: {game.status ?? "unknown"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}