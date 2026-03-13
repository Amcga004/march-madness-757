import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Pick = {
  id: string;
};

type Game = {
  id: string;
};

type Member = {
  id: string;
  display_name: string;
};

type TeamResult = {
  id: string;
  eliminated: boolean;
  total_points: number;
};

export default async function AdminPage() {
  const supabase = await createClient();

  const [
    { data: picks },
    { data: games },
    { data: members },
    { data: teamResults },
  ] = await Promise.all([
    supabase.from("picks").select("id"),
    supabase.from("games").select("id"),
    supabase.from("league_members").select("id, display_name"),
    supabase.from("team_results").select("id, eliminated, total_points"),
  ]);

  const typedPicks = (picks ?? []) as Pick[];
  const typedGames = (games ?? []) as Game[];
  const typedMembers = (members ?? []) as Member[];
  const typedResults = (teamResults ?? []) as TeamResult[];

  const totalPicks = typedPicks.length;
  const totalResults = typedGames.length;
  const teamsAlive = typedResults.filter((team) => team.eliminated === false).length;
  const teamsWithPoints = typedResults.filter((team) => team.total_points > 0).length;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <section className="mb-8">
        <h2 className="text-3xl font-bold">Commissioner Admin Panel</h2>
        <p className="mt-2 text-gray-600">
          Manage draft picks, submit results, and monitor league status.
        </p>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Total Picks Made</div>
          <div className="mt-1 text-3xl font-bold">{totalPicks}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Results Recorded</div>
          <div className="mt-1 text-3xl font-bold">{totalResults}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Teams Alive</div>
          <div className="mt-1 text-3xl font-bold">{teamsAlive}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Teams With Points</div>
          <div className="mt-1 text-3xl font-bold">{teamsWithPoints}</div>
        </div>
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Commissioner Actions</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href="/make-pick"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Make Draft Pick</div>
              <div className="mt-2 text-sm text-gray-600">
                Manually assign a team to a manager.
              </div>
            </Link>

            <Link
              href="/results"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Record Result</div>
              <div className="mt-2 text-sm text-gray-600">
                Enter winner, loser, and round to update scoring.
              </div>
            </Link>

            <Link
              href="/draft"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Open Draft Room</div>
              <div className="mt-2 text-sm text-gray-600">
                View current pick and continue the live draft.
              </div>
            </Link>

            <Link
              href="/history"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Review Results History</div>
              <div className="mt-2 text-sm text-gray-600">
                Confirm which game results have already been entered.
              </div>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">League Navigation</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href="/"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Dashboard</div>
              <div className="mt-2 text-sm text-gray-600">
                View leaderboard, recent results, and league snapshot.
              </div>
            </Link>

            <Link
              href="/rosters"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Rosters</div>
              <div className="mt-2 text-sm text-gray-600">
                Review every manager’s teams and current status.
              </div>
            </Link>

            <Link
              href="/standings"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Standings Detail</div>
              <div className="mt-2 text-sm text-gray-600">
                View expanded points, wins, and roster breakdowns.
              </div>
            </Link>

            <Link
              href="/picks"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Pick Log</div>
              <div className="mt-2 text-sm text-gray-600">
                Review completed draft picks in order.
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">League Members</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {typedMembers.map((member) => (
            <div key={member.id} className="rounded-xl border p-4">
              <div className="font-semibold">{member.display_name}</div>
              <div className="mt-1 text-sm text-gray-600">
                Commissioner access page can be used to manage picks and results.
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}