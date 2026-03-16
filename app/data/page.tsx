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
  | "value_score"
  | "risk_score"
  | "contender_score"
  | "upset_score"
  | "off_efficiency"
  | "def_efficiency"
  | "off_efg_pct"
  | "def_efg_pct"
  | "adj_tempo"
  | "sos_net_rating"
  | "quad1_record"
  | "quad2_record";

type SortDirection = "asc" | "desc";

type TeamIntelligence = {
  compositeRank: number | null;
  valueScore: number | null;
  riskScore: number | null;
  contenderScore: number | null;
  upsetScore: number | null;
  archetypeTags: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && !Number.isNaN(value)
  );

  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

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

function parseWinPct(record: string | null) {
  if (!record) return null;

  const [winsString, lossesString] = record.split("-");
  const wins = Number(winsString);
  const losses = Number(lossesString);

  if (Number.isNaN(wins) || Number.isNaN(losses) || wins + losses === 0) {
    return null;
  }

  return wins / (wins + losses);
}

function getCompositeRank(team: Team) {
  return average([team.kenpom_rank, team.bpi_rank, team.net_rank]);
}

function getTeamIntelligence(team: Team): TeamIntelligence {
  const compositeRank = getCompositeRank(team);
  const quad1Wins = parseQuadWins(team.quad1_record);
  const quad1Losses = parseQuadLosses(team.quad1_record);
  const quad2Wins = parseQuadWins(team.quad2_record);
  const quad2Losses = parseQuadLosses(team.quad2_record);
  const quad1Pct =
    quad1Wins >= 0 && quad1Losses < 999 && quad1Wins + quad1Losses > 0
      ? quad1Wins / (quad1Wins + quad1Losses)
      : null;
  const quad2Pct =
    quad2Wins >= 0 && quad2Losses < 999 && quad2Wins + quad2Losses > 0
      ? quad2Wins / (quad2Wins + quad2Losses)
      : null;

  const seedValue = typeof team.seed === "number" ? team.seed * 8 : null;
  const valueScore =
    compositeRank !== null && seedValue !== null
      ? Number((seedValue - compositeRank).toFixed(2))
      : null;

  let riskBase = 0;

  if (compositeRank !== null && seedValue !== null && compositeRank > seedValue + 8) {
    riskBase += Math.min(35, (compositeRank - seedValue - 8) * 2.5);
  }

  if (team.def_efficiency !== null) {
    if (team.def_efficiency >= 103) riskBase += 18;
    else if (team.def_efficiency >= 100) riskBase += 10;
  }

  if (quad1Pct !== null) {
    if (quad1Pct < 0.35) riskBase += 20;
    else if (quad1Pct < 0.45) riskBase += 10;
  } else {
    riskBase += 6;
  }

  if (team.sos_net_rating !== null) {
    if (team.sos_net_rating < 0) riskBase += 12;
    else if (team.sos_net_rating < 3) riskBase += 6;
  }

  const riskScore = Number(clamp(riskBase).toFixed(1));

  let contenderBase = 0;

  if (compositeRank !== null) {
    contenderBase += clamp(42 - compositeRank, 0, 40);
  }

  if (team.off_efficiency !== null) {
    contenderBase += clamp((team.off_efficiency - 110) * 1.4, 0, 22);
  }

  if (team.def_efficiency !== null) {
    contenderBase += clamp((102 - team.def_efficiency) * 2.2, 0, 24);
  }

  if (quad1Pct !== null) {
    contenderBase += clamp((quad1Pct - 0.4) * 35, 0, 14);
  }

  const contenderScore = Number(clamp(contenderBase).toFixed(1));

  let upsetBase = 0;

  if (team.seed >= 8) upsetBase += 20;
  else if (team.seed >= 6) upsetBase += 12;

  if (valueScore !== null && valueScore > 0) {
    upsetBase += clamp(valueScore * 2.5, 0, 25);
  }

  if (team.off_efficiency !== null) {
    upsetBase += clamp((team.off_efficiency - 112) * 1.1, 0, 15);
  }

  if (team.def_efficiency !== null) {
    upsetBase += clamp((101.5 - team.def_efficiency) * 1.4, 0, 15);
  }

  if (quad1Pct !== null) {
    upsetBase += clamp((quad1Pct - 0.35) * 24, 0, 10);
  }

  const upsetScore = Number(clamp(upsetBase).toFixed(1));

  const archetypeTags: string[] = [];

  if (team.off_efficiency !== null && team.off_efficiency >= 123) {
    archetypeTags.push("Elite Offense");
  }

  if (team.def_efficiency !== null && team.def_efficiency <= 96) {
    archetypeTags.push("Elite Defense");
  }

  if (
    team.off_efficiency !== null &&
    team.off_efficiency >= 118 &&
    team.def_efficiency !== null &&
    team.def_efficiency <= 99
  ) {
    archetypeTags.push("Balanced Contender");
  }

  if (team.adj_tempo !== null && team.adj_tempo >= 70) {
    archetypeTags.push("Tempo Pressure");
  }

  if (valueScore !== null && valueScore >= 10) {
    archetypeTags.push("Undervalued Seed");
  }

  if (riskScore >= 45) {
    archetypeTags.push("Fragile Resume");
  }

  if (upsetScore >= 45 && team.seed >= 8) {
    archetypeTags.push("Bracket Buster");
  }

  if (compositeRank !== null && compositeRank <= 20 && team.seed >= 5) {
    archetypeTags.push("Analytics Darling");
  }

  return {
    compositeRank: compositeRank === null ? null : Number(compositeRank.toFixed(2)),
    valueScore,
    riskScore,
    contenderScore,
    upsetScore,
    archetypeTags,
  };
}

function getComparisonCellClass(
  winner: "a" | "b" | "tie",
  side: "a" | "b"
) {
  if (winner === "tie") return "text-slate-700";
  if (winner === side) return "bg-emerald-50 text-emerald-700 font-semibold";
  return "text-slate-500";
}

function compareMetricValues(
  aValue: number | null,
  bValue: number | null,
  betterDirection: "higher" | "lower"
): "a" | "b" | "tie" {
  if (aValue === null && bValue === null) return "tie";
  if (aValue !== null && bValue === null) return "a";
  if (aValue === null && bValue !== null) return "b";
  if (aValue === null || bValue === null) return "tie";

  if (aValue === bValue) return "tie";

  if (betterDirection === "higher") {
    return aValue > bValue ? "a" : "b";
  }

  return aValue < bValue ? "a" : "b";
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

function CompareMetricRow({
  label,
  aValue,
  bValue,
  formatter,
  betterDirection,
}: {
  label: string;
  aValue: number | null;
  bValue: number | null;
  formatter: (value: number | null) => string;
  betterDirection: "higher" | "lower";
}) {
  const winner = compareMetricValues(aValue, bValue, betterDirection);

  return (
    <tr className="border-t border-slate-200">
      <td className={`px-4 py-3 ${getComparisonCellClass(winner, "a")}`}>
        {formatter(aValue)}
      </td>
      <td className="px-4 py-3 text-center font-medium text-slate-900">{label}</td>
      <td className={`px-4 py-3 ${getComparisonCellClass(winner, "b")} text-right`}>
        {formatter(bValue)}
      </td>
    </tr>
  );
}

export default function DataPage() {
  const supabase = useMemo(() => createClient(), []);

  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("composite_rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [compareTeamAId, setCompareTeamAId] = useState("none");
  const [compareTeamBId, setCompareTeamBId] = useState("none");

  const compareOptions = useMemo(() => {
  return [...teams].sort((a, b) =>
    a.school_name.localeCompare(b.school_name)
  );
}, [teams]);

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("teams")
        .select(
          "id,school_name,seed,region,kenpom_rank,bpi_rank,net_rank,record,conference_record,off_efficiency,def_efficiency,quad1_record,quad2_record,adj_tempo,sos_net_rating,off_efg_pct,def_efg_pct"
        )
        .not("school_name", "like", "PLAY-IN:%");

      if (data) {
        setTeams(data as Team[]);
      }
    }

    loadData();
  }, [supabase]);

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
      const intelligence = getTeamIntelligence(team);

      if (!query) return true;

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
        intelligence.compositeRank ? `composite ${intelligence.compositeRank.toFixed(2)}` : "",
        ...intelligence.archetypeTags,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    const sorted = [...filtered].sort((a, b) => {
      const aIntel = getTeamIntelligence(a);
      const bIntel = getTeamIntelligence(b);

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
          comparison = (aIntel.compositeRank ?? 9999) - (bIntel.compositeRank ?? 9999);
          break;
        case "value_score":
          comparison = (aIntel.valueScore ?? -9999) - (bIntel.valueScore ?? -9999);
          break;
        case "risk_score":
          comparison = (aIntel.riskScore ?? -9999) - (bIntel.riskScore ?? -9999);
          break;
        case "contender_score":
          comparison = (aIntel.contenderScore ?? -9999) - (bIntel.contenderScore ?? -9999);
          break;
        case "upset_score":
          comparison = (aIntel.upsetScore ?? -9999) - (bIntel.upsetScore ?? -9999);
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

  const compareTeamA = useMemo(() => {
    if (compareTeamAId === "none") return null;
    return teams.find((team) => team.id === compareTeamAId) ?? null;
  }, [teams, compareTeamAId]);

  const compareTeamB = useMemo(() => {
    if (compareTeamBId === "none") return null;
    return teams.find((team) => team.id === compareTeamBId) ?? null;
  }, [teams, compareTeamBId]);

  const comparisonState = useMemo(() => {
    if (!compareTeamA || !compareTeamB) return null;

    return {
      teamA: compareTeamA,
      teamB: compareTeamB,
      intelA: getTeamIntelligence(compareTeamA),
      intelB: getTeamIntelligence(compareTeamB),
    };
  }, [compareTeamA, compareTeamB]);

  return (
    <div className="mx-auto max-w-[1700px] p-4 sm:p-6">
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:mb-8 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-sm">
              Team Analytics Reference
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              2026 Field Data Board
            </h2>
            <p className="mt-3 max-w-5xl text-sm text-slate-600 sm:text-base">
              Tournament field reference board with rankings, efficiency, résumé,
              value, risk, contender profile, upset potential, and comparison tools.
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
              placeholder="Search by team, region, seed, record, ranking, or archetype"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[300px]">
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

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Team Comparison</h3>
            <p className="mt-1 text-sm text-slate-600">
              Choose any two tournament teams to compare their profile side by side.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Team A
              </label>
              <select
                value={compareTeamAId}
                onChange={(e) => setCompareTeamAId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="none">None</option>
                {compareOptions.map((team) => (
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
                value={compareTeamBId}
                onChange={(e) => setCompareTeamBId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="none">None</option>
                {compareOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.school_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!comparisonState ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Select two teams to activate the comparison view.
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <TeamLogo teamName={comparisonState.teamA.school_name} size={36} />
                    <div>
                      <div className="text-lg font-semibold text-slate-950">
                        {comparisonState.teamA.school_name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {comparisonState.teamA.seed} Seed • {comparisonState.teamA.region} • {comparisonState.teamA.record ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comparisonState.intelA.archetypeTags.length > 0 ? (
                      comparisonState.intelA.archetypeTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No archetype tags</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <TeamLogo teamName={comparisonState.teamB.school_name} size={36} />
                    <div>
                      <div className="text-lg font-semibold text-slate-950">
                        {comparisonState.teamB.school_name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {comparisonState.teamB.seed} Seed • {comparisonState.teamB.region} • {comparisonState.teamB.record ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comparisonState.intelB.archetypeTags.length > 0 ? (
                      comparisonState.intelB.archetypeTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No archetype tags</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">{comparisonState.teamA.school_name}</th>
                        <th className="px-4 py-3 text-center">Metric</th>
                        <th className="px-4 py-3 text-right">{comparisonState.teamB.school_name}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <CompareMetricRow
                        label="Composite Rank"
                        aValue={comparisonState.intelA.compositeRank}
                        bValue={comparisonState.intelB.compositeRank}
                        formatter={(value) => (value === null ? "—" : value.toFixed(2))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Value Score"
                        aValue={comparisonState.intelA.valueScore}
                        bValue={comparisonState.intelB.valueScore}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="Risk Score"
                        aValue={comparisonState.intelA.riskScore}
                        bValue={comparisonState.intelB.riskScore}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Contender Score"
                        aValue={comparisonState.intelA.contenderScore}
                        bValue={comparisonState.intelB.contenderScore}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="Upset Score"
                        aValue={comparisonState.intelA.upsetScore}
                        bValue={comparisonState.intelB.upsetScore}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="KenPom Rank"
                        aValue={comparisonState.teamA.kenpom_rank ?? null}
                        bValue={comparisonState.teamB.kenpom_rank ?? null}
                        formatter={(value) => (value === null ? "—" : String(value))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="BPI Rank"
                        aValue={comparisonState.teamA.bpi_rank ?? null}
                        bValue={comparisonState.teamB.bpi_rank ?? null}
                        formatter={(value) => (value === null ? "—" : String(value))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="NET Rank"
                        aValue={comparisonState.teamA.net_rank ?? null}
                        bValue={comparisonState.teamB.net_rank ?? null}
                        formatter={(value) => (value === null ? "—" : String(value))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Off Efficiency"
                        aValue={comparisonState.teamA.off_efficiency ?? null}
                        bValue={comparisonState.teamB.off_efficiency ?? null}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="Def Efficiency"
                        aValue={comparisonState.teamA.def_efficiency ?? null}
                        bValue={comparisonState.teamB.def_efficiency ?? null}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Off eFG%"
                        aValue={comparisonState.teamA.off_efg_pct ?? null}
                        bValue={comparisonState.teamB.off_efg_pct ?? null}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="Def eFG%"
                        aValue={comparisonState.teamA.def_efg_pct ?? null}
                        bValue={comparisonState.teamB.def_efg_pct ?? null}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Adj Tempo"
                        aValue={comparisonState.teamA.adj_tempo ?? null}
                        bValue={comparisonState.teamB.adj_tempo ?? null}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="SOS Net Rating"
                        aValue={comparisonState.teamA.sos_net_rating ?? null}
                        bValue={comparisonState.teamB.sos_net_rating ?? null}
                        formatter={(value) => (value === null ? "—" : value.toFixed(2))}
                        betterDirection="higher"
                      />
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[2100px] w-full text-sm">
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
                    label="Value"
                    sortKey="value_score"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Risk"
                    sortKey="risk_score"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Contender"
                    sortKey="contender_score"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortButton
                    label="Upset"
                    sortKey="upset_score"
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
                <th className="px-4 py-3 text-left">Archetypes</th>
              </tr>
            </thead>

            <tbody>
              {filteredAndSortedTeams.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-4 py-8 text-center text-slate-500">
                    No teams matched your search.
                  </td>
                </tr>
              ) : (
                filteredAndSortedTeams.map((team) => {
                  const intel = getTeamIntelligence(team);

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
                        {intel.compositeRank === null ? "—" : intel.compositeRank.toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {intel.valueScore === null ? "—" : intel.valueScore.toFixed(1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {intel.riskScore === null ? "—" : intel.riskScore.toFixed(1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {intel.contenderScore === null ? "—" : intel.contenderScore.toFixed(1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {intel.upsetScore === null ? "—" : intel.upsetScore.toFixed(1)}
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
                        {team.sos_net_rating == null ? "—" : team.sos_net_rating.toFixed(2)}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {team.quad1_record ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {team.quad2_record ?? "—"}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {intel.archetypeTags.length > 0 ? (
                            intel.archetypeTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
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