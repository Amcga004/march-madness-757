import { supabaseAdmin } from "@/lib/supabase-admin";

type ArchivedStanding = {
  id: string;
  season_year: number;
  manager_name: string;
  final_rank: number;
  final_points: number;
  live_teams: number;
  drafted_teams: string[];
  created_at: string;
};

const managerColorMap: Record<string, string> = {
  Andrew: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  Wesley: "bg-green-100 text-green-700 ring-1 ring-green-200",
  Eric: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
  Greg: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
};

function getManagerBadgeClasses(name: string) {
  return (
    managerColorMap[name] ??
    "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
  );
}

export const metadata = {
  title: "Seasons",
  description: "Archived March Madness fantasy draft standings by season.",
};

export default async function SeasonsPage() {
  const { data, error } = await supabaseAdmin
    .from("season_final_standings")
    .select("*")
    .order("season_year", { ascending: false })
    .order("final_rank", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          Failed to load archived seasons: {error.message}
        </div>
      </main>
    );
  }

  const rows = (data ?? []) as ArchivedStanding[];

  const grouped = rows.reduce<Record<number, ArchivedStanding[]>>((acc, row) => {
    if (!acc[row.season_year]) {
      acc[row.season_year] = [];
    }
    acc[row.season_year].push(row);
    return acc;
  }, {});

  const years = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:space-y-8 sm:p-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Seasons Archive
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Historical final standings for each completed March Madness fantasy
          draft season.
        </p>
      </section>

      {years.length === 0 ? (
        <section className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold">No archived seasons yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Once a season is complete, archive the standings from the Admin
            Panel before resetting the league.
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {years.map((year) => {
            const standings = grouped[year];

            return (
              <section
                key={year}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              >
                <div className="border-b bg-slate-50 px-5 py-4 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{year} Season</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Final archived standings
                      </p>
                    </div>

                    {standings[0] && (
                      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
                          Champion
                        </div>
                        <div className="mt-1 text-lg font-bold text-yellow-900">
                          {standings[0].manager_name}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="divide-y">
                  {standings.map((row) => {
                    const isChampion = row.final_rank === 1;

                    return (
                      <div
                        key={row.id}
                        className={`px-4 py-4 sm:px-6 ${
                          isChampion ? "bg-yellow-50/60" : "bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                isChampion
                                  ? "bg-yellow-400 text-black"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              #{row.final_rank}
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-lg font-semibold">
                                  {row.manager_name}
                                </span>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${getManagerBadgeClasses(
                                    row.manager_name
                                  )}`}
                                >
                                  {row.manager_name}
                                </span>

                                {isChampion && (
                                  <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800 ring-1 ring-yellow-200">
                                    Champion
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 text-sm text-slate-500">
                                Drafted teams: {row.drafted_teams.length} • Live
                                teams at archive: {row.live_teams}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:min-w-[220px]">
                            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-center">
                              <div className="text-xs uppercase tracking-wide text-slate-500">
                                Final Points
                              </div>
                              <div className="mt-1 text-xl font-bold">
                                {row.final_points}
                              </div>
                            </div>

                            <div className="rounded-xl border bg-slate-50 px-3 py-2 text-center">
                              <div className="text-xs uppercase tracking-wide text-slate-500">
                                Live Teams
                              </div>
                              <div className="mt-1 text-xl font-bold">
                                {row.live_teams}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}