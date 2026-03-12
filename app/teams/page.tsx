import { createClient } from "@/lib/supabase/server";

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

export default async function TeamsPage() {
  const supabase = await createClient();

  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .order("region", { ascending: true })
    .order("seed", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-bold">Teams</h1>
        <p className="mt-4 text-red-600">Error loading teams: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Teams</h1>
        <p className="mt-2 text-gray-600">
          These teams are being loaded directly from Supabase.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(teams as Team[]).map((team) => (
          <div key={team.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-lg font-semibold">{team.school_name}</div>
            <div className="mt-1 text-sm text-gray-600">
              {team.seed} Seed • {team.region}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}