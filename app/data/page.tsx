"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  quad1_record: string | null;
  quad2_record: string | null;
  adj_tempo: number | null;
  sos_net_rating: number | null;
  off_efg_pct: number | null;
  def_efg_pct: number | null;
};

type SortKey =
  | "school_name"
  | "record"
  | "kenpom_rank"
  | "bpi_rank"
  | "net_rank"
  | "composite_rank"
  | "off_efficiency"
  | "def_efficiency"
  | "off_efg_pct"
  | "def_efg_pct"
  | "adj_tempo"
  | "sos_net_rating"
  | "quad1_record"
  | "quad2_record";

type SortDirection = "asc" | "desc";
type ComparisonWinner = "a" | "b" | "tie";

type ComparisonRow = {
  label: string;
  displayA: string;
  displayB: string;
  winner: ComparisonWinner;
};

function formatMetric(value: number | null, digits = 1) {
  if (value === null || value === undefined) return "—";
  return value.toFixed(digits);
}

function formatRank(value: number | null) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function parseRecordWins(record: string | null) {
  if (!record) return -1;
  const [wins] = record.split("-");
  const parsed = Number(wins);
  return Number.isNaN(parsed) ? -1 : parsed;
}

function parseRecordLosses(record: string | null) {
  if (!record) return 999;
  const [, losses] = record.split("-");
  const parsed = Number(losses);
  return Number.isNaN(parsed) ? 999 : parsed;
}

function parseQuadWins(record: string | null) {
  if (!record) return -1;
  const [wins] = record.split("-");
  const parsed = Number(wins);
  return Number.isNaN(parsed) ? -1 : parsed;
}

function parseQuadLosses(record: string | null) {
  if (!record) return 999;
  const [, losses] = record.split("-");
  const parsed = Number(losses);
  return Number.isNaN(parsed) ? 999 : parsed;
}

function getCompositeRank(team: Team) {
  const ranks = [team.kenpom_rank, team.bpi_rank, team.net_rank].filter(
    (value): value is number => value !== null && value !== undefined
  );

  if (ranks.length === 0) return null;

  return ranks.reduce((sum, value) => sum + value, 0) / ranks.length;
}

function getComparisonWinner(
  valueA: number | string | null,
  valueB: number | string | null,
  mode: "higher" | "lower" | "record"
): ComparisonWinner {
  if (valueA === null || valueA === undefined || valueB === null || valueB === undefined) {
    return "tie";
  }

  if (mode === "record") {
    const winsA = parseQuadWins(String(valueA));
    const winsB = parseQuadWins(String(valueB));
    const lossesA = parseQuadLosses(String(valueA));
    const lossesB = parseQuadLosses(String(valueB));

    if (winsA > winsB) return "a";
    if (winsB > winsA) return "b";
    if (lossesA < lossesB) return "a";
    if (lossesB < lossesA) return "b";
    return "tie";
  }

  const numA = typeof valueA === "string" ? Number(valueA) : valueA;
  const numB = typeof valueB === "string" ? Number(valueB) : valueB;

  if (Number.isNaN(numA) || Number.isNaN(numB)) return "tie";

  if (mode === "higher") {
    if (numA > numB) return "a";
    if (numB > numA) return "b";
    return "tie";
  }

  if (numA < numB) return "a";
  if (numB < numA) return "b";
  return "tie";
}

function getComparisonCellClass(winner: ComparisonWinner, side: "a" | "b") {
  if (winner === "tie") return "text-slate-700";
  return winner === side ? "font-semibold text-emerald-700" : "text-slate-500";
}

function SortButton({
  label,
  sortKey,
  activeSortKey,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  onClick: (key: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const isActive = activeSortKey === sortKey;
  const arrow = isActive ? (direction === "asc" ? "▲" : "▼") : "";

  const alignmentClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
        ? "justify-center text-center"
        : "justify-start text-left";

  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={`flex w-full items-center gap-2 ${alignmentClass} font-semibold text-white`}
    >
      <span>{label}</span>
      <span className="text-[10px] text-slate-300">{arrow}</span>
    </button>
  );
}

export default function DataPage() {
  const supabase = useMemo(() => createClient(), []);

  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("composite_rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [compareTeamAId, setCompareTeamAId] = useState("");
  const [compareTeamBId, setCompareTeamBId] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("teams")
        .select(
          "id,school_name,seed,region,kenpom_rank,bpi_rank,net_rank,record,conference_record,off_efficiency,def_efficiency,quad1_record,quad2_record,adj_tempo,sos_net_rating,off_efg_pct,def_efg_pct"
        )
        .not("school_name", "like", "PLAY-IN:%");

      if (data) {
        const typedTeams = data as Team[];
        setTeams(typedTeams);
      }
    }

    loadData();
  }, [supabase]);

  const sortedTeamsForDropdown = useMemo(() => {
    return [...teams].sort((a, b) => a.school_name.localeCompare(b.school_name));
  }, [teams]);

  useEffect(() => {
    if (sortedTeamsForDropdown.length === 0) return;

    if (!compareTeamAId) {
      setCompareTeamAId(sortedTeamsForDropdown[0]?.id ?? "");
    }

    if (!compareTeamBId) {
      setCompareTeamBId(sortedTeamsForDropdown[1]?.id ?? sortedTeamsForDropdown[0]?.id ?? "");
    }
  }, [sortedTeamsForDropdown, compareTeamAId, compareTeamBId]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  const filteredAndSortedTeams = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = teams.filter((team) => {
      if (!query) return true;

      const compositeRank = getCompositeRank(team);

      const searchable = [
        team.school_name,
        team.region,
        String(team.seed),
        team.record ?? "",
        team.quad1_record ?? "",
        team.quad2_record ?? "",
        team.kenpom_rank ? `kenpom ${team.kenpom_rank}` : "",
        team.bpi_rank ? `bpi ${team.bpi_rank}` : "",
        team.net_rank ? `net ${team.net_rank}` : "",
        compositeRank ? `composite ${compositeRank.toFixed(2)}` : "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    const sorted = [...filtered].sort((a, b) => {
      const compositeA = getCompositeRank(a);
      const compositeB = getCompositeRank(b);

      let comparison = 0;

      switch (sortKey) {
        case "school_name":
          comparison = a.school_name.localeCompare(b.school_name);
          break;
        case "record":
          comparison = parseRecordWins(a.record) - parseRecordWins(b.record);
          if (comparison === 0) {
            comparison = parseRecordLosses(a.record) - parseRecordLosses(b.record);
          }
          comparison *= -1;
          break;
        case "kenpom_rank":
          comparison = (a.kenpom_rank ?? 9999) - (b.kenpom_rank ?? 9999);
          break;
        case "bpi_rank":
          comparison = (a.bpi_rank ?? 9999) - (b.bpi_rank ?? 9999);
          break;
        case "net_rank":
          comparison = (a.net_rank ?? 9999) - (b.net_rank ?? 9999);
          break;
        case "composite_rank":
          comparison = (compositeA ?? 9999) - (compositeB ?? 9999);
          break;
        case "off_efficiency":
          comparison = (a.off_efficiency ?? -9999) - (b.off_efficiency ?? -9999);
          break;
        case "def_efficiency":
          comparison = (a.def_efficiency ?? 9999) - (b.def_efficiency ?? 9999);
          break;
        case "off_efg_pct":
          comparison = (a.off_efg_pct ?? -9999) - (b.off_efg_pct ?? -9999);
          break;
        case "def_efg_pct":
          comparison = (a.def_efg_pct ?? 9999) - (b.def_efg_pct ?? 9999);
          break;
        case "adj_tempo":
          comparison = (a.adj_tempo ?? -9999) - (b.adj_tempo ?? -9999);
          break;
        case "sos_net_rating":
          comparison = (a.sos_net_rating ?? -9999) - (b.sos_net_rating ?? -9999);
          break;
        case "quad1_record":
          comparison = parseQuadWins(a.quad1_record) - parseQuadWins(b.quad1_record);
          if (comparison === 0) {
            comparison = parseQuadLosses(a.quad1_record) - parseQuadLosses(b.quad1_record);
          }
          comparison *= -1;
          break;
        case "quad2_record":
          comparison = parseQuadWins(a.quad2_record) - parseQuadWins(b.quad2_record);
          if (comparison === 0) {
            comparison = parseQuadLosses(a.quad2_record) - parseQuadLosses(b.quad2_record);
          }
          comparison *= -1;
          break;
        default:
          comparison = 0;
      }

      if (comparison === 0) {
        comparison = a.school_name.localeCompare(b.school_name);
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });

    return sorted;
  }, [teams, search, sortKey, sortDirection]);

  const compareTeamA = useMemo(
    () => teams.find((team) => team.id === compareTeamAId) ?? null,
    [teams, compareTeamAId]
  );

  const compareTeamB = useMemo(
    () => teams.find((team) => team.id === compareTeamBId) ?? null,
    [teams, compareTeamBId]
  );

  const comparisonRows = useMemo<ComparisonRow[]>(() => {
    if (!compareTeamA || !compareTeamB) return [];

    const compositeA = getCompositeRank(compareTeamA);
    const compositeB = getCompositeRank(compareTeamB);

    return [
      {
        label: "Seed",
        displayA: String(compareTeamA.seed),
        displayB: String(compareTeamB.seed),
        winner: getComparisonWinner(compareTeamA.seed, compareTeamB.seed, "lower"),
      },
      {
        label: "Region",
        displayA: compareTeamA.region,
        displayB: compareTeamB.region,
        winner: "tie",
      },
      {
        label: "Overall Record",
        displayA: compareTeamA.record ?? "—",
        displayB: compareTeamB.record ?? "—",
        winner: getComparisonWinner(compareTeamA.record, compareTeamB.record, "record"),
      },
      {
        label: "KenPom Rank",
        displayA: formatRank(compareTeamA.kenpom_rank),
        displayB: formatRank(compareTeamB.kenpom_rank),
        winner: getComparisonWinner(compareTeamA.kenpom_rank, compareTeamB.kenpom_rank, "lower"),
      },
      {
        label: "BPI Rank",
        displayA: formatRank(compareTeamA.bpi_rank),
        displayB: formatRank(compareTeamB.bpi_rank),
        winner: getComparisonWinner(compareTeamA.bpi_rank, compareTeamB.bpi_rank, "lower"),
      },
      {
        label: "NET Rank",
        displayA: formatRank(compareTeamA.net_rank),
        displayB: formatRank(compareTeamB.net_rank),
        winner: getComparisonWinner(compareTeamA.net_rank, compareTeamB.net_rank, "lower"),
      },
      {
        label: "Composite Rank",
        displayA: compositeA === null ? "—" : compositeA.toFixed(2),
        displayB: compositeB === null ? "—" : compositeB.toFixed(2),
        winner: getComparisonWinner(compositeA, compositeB, "lower"),
      },
      {
        label: "KenPom Off Eff",
        displayA: formatMetric(compareTeamA.off_efficiency),
        displayB: formatMetric(compareTeamB.off_efficiency),
        winner: getComparisonWinner(compareTeamA.off_efficiency, compareTeamB.off_efficiency, "higher"),
      },
      {
        label: "KenPom Def Eff",
        displayA: formatMetric(compareTeamA.def_efficiency),
        displayB: formatMetric(compareTeamB.def_efficiency),
        winner: getComparisonWinner(compareTeamA.def_efficiency, compareTeamB.def_efficiency, "lower"),
      },
      {
        label: "Off eFG%",
        displayA: formatMetric(compareTeamA.off_efg_pct),
        displayB: formatMetric(compareTeamB.off_efg_pct),
        winner: getComparisonWinner(compareTeamA.off_efg_pct, compareTeamB.off_efg_pct, "higher"),
      },
      {
        label: "Def eFG%",
        displayA: formatMetric(compareTeamA.def_efg_pct),
        displayB: formatMetric(compareTeamB.def_efg_pct),
        winner: getComparisonWinner(compareTeamA.def_efg_pct, compareTeamB.def_efg_pct, "lower"),
      },
      {
        label: "Adj Tempo",
        displayA: formatMetric(compareTeamA.adj_tempo),
        displayB: formatMetric(compareTeamB.adj_tempo),
        winner: getComparisonWinner(compareTeamA.adj_tempo, compareTeamB.adj_tempo, "higher"),
      },
      {
        label: "SOS Net",
        displayA:
          compareTeamA.sos_net_rating === null || compareTeamA.sos_net_rating === undefined
            ? "—"
            : compareTeamA.sos_net_rating.toFixed(2),
        displayB:
          compareTeamB.sos_net_rating === null || compareTeamB.sos_net_rating === undefined
            ? "—"
            : compareTeamB.sos_net_rating.toFixed(2),
        winner: getComparisonWinner(compareTeamA.sos_net_rating, compareTeamB.sos_net_rating, "higher"),
      },
      {
        label: "Quad 1",
        displayA: compareTeamA.quad1_record ?? "—",
        displayB: compareTeamB.quad1_record ?? "—",
        winner: getComparisonWinner(compareTeamA.quad1_record, compareTeamB.quad1_record, "record"),
      },
      {
        label: "Quad 2",
        displayA: compareTeamA.quad2_record ?? "—",
        displayB: compareTeamB.quad2_record ?? "—",
        winner: getComparisonWinner(compareTeamA.quad2_record, compareTeamB.quad2_record, "record"),
      },
    ];
  }, [compareTeamA, compareTeamB]);

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:mb-8 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-sm">
              Team Analytics Reference
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              2026 Field Data Board
            </h2>
            <p className="mt-3 max-w-4xl text-sm text-slate-600 sm:text-base">
              Tournament field reference board with ranking, efficiency, tempo,
              résumé, and composite profile data across KenPom, BPI, and NET.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Teams Shown
            </div>
            <div className="mt-1 text-lg font-semibold">
              {filteredAndSortedTeams.length}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <label
              htmlFor="team-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Search Teams
            </label>
            <input
              id="team-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by team, region, seed, record, or ranking"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Default Sort
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                Composite Rank
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current Sort
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {sortKey.replaceAll("_", " ")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:mb-8 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-sm">
              Head-to-Head Comparison
            </div>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Compare Two Teams
            </h3>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Select any two field teams and compare their profile side by side across
              ranking, efficiency, tempo, résumé, and quadrant performance.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Team A
            </label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={compareTeamAId}
              onChange={(e) => setCompareTeamAId(e.target.value)}
            >
              {sortedTeamsForDropdown.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.school_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Team B
            </label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={compareTeamBId}
              onChange={(e) => setCompareTeamBId(e.target.value)}
            >
              {sortedTeamsForDropdown.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.school_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {compareTeamA && compareTeamB ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-4 text-left">
                      <div className="flex items-center gap-3">
                        <TeamLogo teamName={compareTeamA.school_name} size={30} />
                        <div>
                          <div className="font-semibold">{compareTeamA.school_name}</div>
                          <div className="text-xs text-slate-300">
                            {compareTeamA.seed} Seed • {compareTeamA.region}
                          </div>
                        </div>
                      </div>
                    </th>
                    <th className="px-4 py-4 text-center font-semibold">Metric</th>
                    <th className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="text-right">
                          <div className="font-semibold">{compareTeamB.school_name}</div>
                          <div className="text-xs text-slate-300">
                            {compareTeamB.seed} Seed • {compareTeamB.region}
                          </div>
                        </div>
                        <TeamLogo teamName={compareTeamB.school_name} size={30} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-t border-slate-200">
                      <td className={`px-4 py-3 ${getComparisonCellClass(row.winner, "a")}`}>
                        {row.displayA}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-900">
                        {row.label}
                      </td>
                      <td className={`px-4 py-3 text-right ${getComparisonCellClass(row.winner, "b")}`}>
                        {row.displayB}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-3 text-left">
                  <SortButton
                    label="Team"
                    sortKey="school_name"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortButton
                    label="Record"
                    sortKey="record"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="KP"
                    sortKey="kenpom_rank"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="BPI"
                    sortKey="bpi_rank"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="NET"
                    sortKey="net_rank"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Composite"
                    sortKey="composite_rank"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Off Eff"
                    sortKey="off_efficiency"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Def Eff"
                    sortKey="def_efficiency"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Off eFG%"
                    sortKey="off_efg_pct"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Def eFG%"
                    sortKey="def_efg_pct"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Adj Tempo"
                    sortKey="adj_tempo"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="SOS Net"
                    sortKey="sos_net_rating"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortButton
                    label="Quad 1"
                    sortKey="quad1_record"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortButton
                    label="Quad 2"
                    sortKey="quad2_record"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                  />
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredAndSortedTeams.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                    No teams matched your search.
                  </td>
                </tr>
              ) : (
                filteredAndSortedTeams.map((team) => {
                  const compositeRank = getCompositeRank(team);

                  return (
                    <tr
                      key={team.id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <TeamLogo teamName={team.school_name} size={28} />
                          <div>
                            <div className="font-medium text-slate-900">
                              {team.school_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {team.seed} Seed • {team.region}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {team.record ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatRank(team.kenpom_rank)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatRank(team.bpi_rank)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatRank(team.net_rank)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {compositeRank === null ? "—" : compositeRank.toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatMetric(team.off_efficiency)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatMetric(team.def_efficiency)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatMetric(team.off_efg_pct, 1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatMetric(team.def_efg_pct, 1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatMetric(team.adj_tempo, 1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {team.sos_net_rating === null || team.sos_net_rating === undefined
                          ? "—"
                          : team.sos_net_rating.toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {team.quad1_record ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {team.quad2_record ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}