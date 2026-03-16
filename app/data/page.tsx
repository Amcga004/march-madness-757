import { createClient } from "@/lib/supabase/server";
import TeamLogo from "../components/TeamLogo";

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
  kenpom_rank: number | null;
  bpi_rank: number | null;
  net_rank: number | null;
  record: string | null;
  conference_record: string | null;
  off_efficiency: number | null;
  def_efficiency: number | null;
};

function formatMetric(value: number | null) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default async function DataPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = resolvedSearchParams.q?.trim().toLowerCase() ?? "";

  const { data } = await supabase
    .from("teams")
    .select(
      "id,school_name,seed,region,kenpom_rank,bpi_rank,net_rank,record,conference_record,off_efficiency,def_efficiency"
    )
    .not("school_name", "like", "PLAY-IN:%");

  const teams = ((data ?? []) as Team[])
    .filter((team) => {
      if (!query) return true;

      const searchable = [
        team.school_name,
        team.region,
        String(team.seed),
        team.record ?? "",
        team.conference_record ?? "",
        team.kenpom_rank ? `kenpom ${team.kenpom_rank}` : "",
        team.bpi_rank ? `bpi ${team.bpi_rank}` : "",
        team.net_rank ? `net ${team.net_rank}` : "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    })
    .sort((a, b) => {
      const aRank = a.kenpom_rank ?? 9999;
      const bRank = b.kenpom_rank ?? 9999;

      if (aRank !== bRank) return aRank - bRank;
      if (a.seed !== b.seed) return a.seed - b.seed;
      return a.school_name.localeCompare(b.school_name);
    });

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:mb-8 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-sm">
              Team Analytics Reference
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              2026 Team Data Board
            </h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
              Central reference table for tournament teams and pre-draft analytics,
              including seed, region, KenPom, BPI, NET, record, and efficiency data.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Teams Shown
            </div>
            <div className="mt-1 text-lg font-semibold">{teams.length}</div>
          </div>
        </div>

        <form method="get" className="mt-6">
          <label htmlFor="team-search" className="mb-2 block text-sm font-medium text-slate-700">
            Search Teams
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="team-search"
              name="q"
              defaultValue={resolvedSearchParams.q ?? ""}
              placeholder="Search by team, region, seed, record, or ranking"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-950 px-4 py-2 text-white"
            >
              Search
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Team</th>
                <th className="px-4 py-3 text-left font-semibold">Seed</th>
                <th className="px-4 py-3 text-left font-semibold">Region</th>
                <th className="px-4 py-3 text-left font-semibold">KenPom</th>
                <th className="px-4 py-3 text-left font-semibold">BPI</th>
                <th className="px-4 py-3 text-left font-semibold">NET</th>
                <th className="px-4 py-3 text-left font-semibold">Record</th>
                <th className="px-4 py-3 text-left font-semibold">Conf</th>
                <th className="px-4 py-3 text-left font-semibold">Off Eff</th>
                <th className="px-4 py-3 text-left font-semibold">Def Eff</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    No teams matched your search.
                  </td>
                </tr>
              ) : (
                teams.map((team) => (
                  <tr
                    key={team.id}
                    className="border-t border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TeamLogo teamName={team.school_name} size={28} />
                        <span className="font-medium text-slate-900">{team.school_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{team.seed}</td>
                    <td className="px-4 py-3 text-slate-700">{team.region}</td>
                    <td className="px-4 py-3 text-slate-700">{team.kenpom_rank ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{team.bpi_rank ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{team.net_rank ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{team.record ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{team.conference_record ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMetric(team.off_efficiency)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMetric(team.def_efficiency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}