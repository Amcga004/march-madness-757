"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TeamLogo from "../components/TeamLogo";
import {
  getCompositeRank,
  getTeamIntelligence,
} from "@/lib/teamIntelligence";

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
  value_score: number | null;
  risk_score: number | null;
  upset_score: number | null;
  contender_score: number | null;
  archetype_tags: string[];
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
  | "quad2_record"
  | "value_score"
  | "risk_score"
  | "upset_score"
  | "contender_score";

type SortDirection = "asc" | "desc";

type CompareMetricRowProps = {
  label: string;
  aValue: number | null;
  bValue: number | null;
  formatter: (value: number | null) => string;
  betterDirection: "higher" | "lower";
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

function getCompositeRankDisplay(team: Team) {
  return getCompositeRank(team);
}

function getArchetypeBadgeClasses(tag: string) {
  const normalized = tag.toLowerCase();

  if (normalized.includes("offense") || normalized.includes("offensive")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized.includes("defense") || normalized.includes("defensive")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized.includes("balanced")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (
    normalized.includes("title") ||
    normalized.includes("contender") ||
    normalized.includes("threat")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized.includes("upset") || normalized.includes("sleeper")) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (normalized.includes("risk") || normalized.includes("volatile")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (normalized.includes("tempo") || normalized.includes("fast")) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (normalized.includes("slow")) {
    return "border-stone-200 bg-stone-50 text-stone-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function ArchetypeTag({ tag }: { tag: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getArchetypeBadgeClasses(
        tag
      )}`}
    >
      {tag}
    </span>
  );
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
}: CompareMetricRowProps) {
  const hasA = aValue !== null && aValue !== undefined;
  const hasB = bValue !== null && bValue !== undefined;

  let aHighlight = "";
  let bHighlight = "";

  if (hasA && hasB && aValue !== bValue) {
    const aBetter =
      betterDirection === "higher"
        ? (aValue as number) > (bValue as number)
        : (aValue as number) < (bValue as number);

    if (aBetter) {
      aHighlight = "font-semibold text-emerald-700";
      bHighlight = "text-slate-600";
    } else {
      aHighlight = "text-slate-600";
      bHighlight = "font-semibold text-emerald-700";
    }
  }

  return (
    <tr className="border-t border-slate-200">
      <td className={`px-4 py-3 text-left ${aHighlight}`}>
        {formatter(aValue)}
      </td>
      <td className="px-4 py-3 text-center font-medium text-slate-700">
        {label}
      </td>
      <td className={`px-4 py-3 text-right ${bHighlight}`}>
        {formatter(bValue)}
      </td>
    </tr>
  );
}

function MobileMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
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
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const compareOptions = useMemo(() => {
    return [...teams].sort((a, b) => a.school_name.localeCompare(b.school_name));
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
        const enrichedTeams = (data as Omit<
          Team,
          "value_score" | "risk_score" | "upset_score" | "contender_score" | "archetype_tags"
        >[]).map((team) => {
          const intelligence = getTeamIntelligence(team);

          return {
            ...team,
            value_score: intelligence.value_score,
            risk_score: intelligence.risk_score,
            upset_score: intelligence.upset_score,
            contender_score: intelligence.contender_score,
            archetype_tags: intelligence.archetype_tags,
          };
        });

        setTeams(enrichedTeams);
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

  const filteredAndSortedTeams = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = teams.filter((team) => {
      if (!query) return true;

      const compositeRank = getCompositeRankDisplay(team);

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
        team.value_score !== null && team.value_score !== undefined
          ? `value ${team.value_score.toFixed(1)}`
          : "",
        team.risk_score !== null && team.risk_score !== undefined
          ? `risk ${team.risk_score.toFixed(1)}`
          : "",
        team.upset_score !== null && team.upset_score !== undefined
          ? `upset ${team.upset_score.toFixed(1)}`
          : "",
        team.contender_score !== null && team.contender_score !== undefined
          ? `contender ${team.contender_score.toFixed(1)}`
          : "",
        ...(team.archetype_tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    const sorted = [...filtered].sort((a, b) => {
      const compositeA = getCompositeRankDisplay(a);
      const compositeB = getCompositeRankDisplay(b);

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
        case "value_score":
          comparison = (a.value_score ?? -9999) - (b.value_score ?? -9999);
          break;
        case "risk_score":
          comparison = (a.risk_score ?? -9999) - (b.risk_score ?? -9999);
          break;
        case "upset_score":
          comparison = (a.upset_score ?? -9999) - (b.upset_score ?? -9999);
          break;
        case "contender_score":
          comparison = (a.contender_score ?? -9999) - (b.contender_score ?? -9999);
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

  return (
    <div className="mx-auto max-w-[1700px] p-4 sm:p-6">
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Data
            </div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              2026 Field Analytics
            </h2>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Search, compare, and sort tournament teams across rankings,
              efficiency, résumé, and derived intelligence signals.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Teams Shown
            </div>
            <div className="mt-1 text-lg font-semibold">
              {filteredAndSortedTeams.length}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
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
              placeholder="Search by team, region, seed, record, tag, or ranking"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Default Sort
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                Composite Rank
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Current Sort
              </div>
              <div className="mt-1 text-sm font-semibold capitalize text-slate-900">
                {sortKey.replaceAll("_", " ")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950 sm:text-xl">
              Team Comparison
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Select two teams to compare profile, rankings, and intelligence scores.
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
                <option value="none">NONE</option>
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
                <option value="none">NONE</option>
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
                        {comparisonState.teamA.seed} Seed • {comparisonState.teamA.region} •{" "}
                        {comparisonState.teamA.record ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comparisonState.intelA.archetype_tags.length > 0 ? (
                      comparisonState.intelA.archetype_tags.map((tag) => (
                        <ArchetypeTag key={tag} tag={tag} />
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
                        {comparisonState.teamB.seed} Seed • {comparisonState.teamB.region} •{" "}
                        {comparisonState.teamB.record ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comparisonState.intelB.archetype_tags.length > 0 ? (
                      comparisonState.intelB.archetype_tags.map((tag) => (
                        <ArchetypeTag key={tag} tag={tag} />
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No archetype tags</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:hidden">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-900">
                    {comparisonState.teamA.school_name}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MobileMetric
                      label="Composite"
                      value={
                        comparisonState.intelA.composite_rank === null
                          ? "—"
                          : comparisonState.intelA.composite_rank.toFixed(2)
                      }
                    />
                    <MobileMetric
                      label="Value"
                      value={
                        comparisonState.intelA.value_score === null
                          ? "—"
                          : comparisonState.intelA.value_score.toFixed(1)
                      }
                    />
                    <MobileMetric
                      label="Risk"
                      value={
                        comparisonState.intelA.risk_score === null
                          ? "—"
                          : comparisonState.intelA.risk_score.toFixed(1)
                      }
                    />
                    <MobileMetric
                      label="Contender"
                      value={
                        comparisonState.intelA.contender_score === null
                          ? "—"
                          : comparisonState.intelA.contender_score.toFixed(1)
                      }
                    />
                    <MobileMetric
                      label="KenPom"
                      value={formatRank(comparisonState.teamA.kenpom_rank)}
                    />
                    <MobileMetric
                      label="NET"
                      value={formatRank(comparisonState.teamA.net_rank)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-900">
                    {comparisonState.teamB.school_name}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MobileMetric
                      label="Composite"
                      value={
                        comparisonState.intelB.composite_rank === null
                          ? "—"
                          : comparisonState.intelB.composite_rank.toFixed(2)
                      }
                    />
                    <MobileMetric
                      label="Value"
                      value={
                        comparisonState.intelB.value_score === null
                          ? "—"
                          : comparisonState.intelB.value_score.toFixed(1)
                      }
                    />
                    <MobileMetric
                      label="Risk"
                      value={
                        comparisonState.intelB.risk_score === null
                          ? "—"
                          : comparisonState.intelB.risk_score.toFixed(1)
                      }
                    />
                    <MobileMetric
                      label="Contender"
                      value={
                        comparisonState.intelB.contender_score === null
                          ? "—"
                          : comparisonState.intelB.contender_score.toFixed(1)
                      }
                    />
                    <MobileMetric
                      label="KenPom"
                      value={formatRank(comparisonState.teamB.kenpom_rank)}
                    />
                    <MobileMetric
                      label="NET"
                      value={formatRank(comparisonState.teamB.net_rank)}
                    />
                  </div>
                </div>
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-slate-950 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          {comparisonState.teamA.school_name}
                        </th>
                        <th className="px-4 py-3 text-center">Metric</th>
                        <th className="px-4 py-3 text-right">
                          {comparisonState.teamB.school_name}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <CompareMetricRow
                        label="Composite Rank"
                        aValue={comparisonState.intelA.composite_rank}
                        bValue={comparisonState.intelB.composite_rank}
                        formatter={(value) => (value === null ? "—" : value.toFixed(2))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Value Score"
                        aValue={comparisonState.intelA.value_score}
                        bValue={comparisonState.intelB.value_score}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="Risk Score"
                        aValue={comparisonState.intelA.risk_score}
                        bValue={comparisonState.intelB.risk_score}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Upset Score"
                        aValue={comparisonState.intelA.upset_score}
                        bValue={comparisonState.intelB.upset_score}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="Contender Score"
                        aValue={comparisonState.intelA.contender_score}
                        bValue={comparisonState.intelB.contender_score}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="KenPom Rank"
                        aValue={comparisonState.teamA.kenpom_rank}
                        bValue={comparisonState.teamB.kenpom_rank}
                        formatter={(value) => (value === null ? "—" : String(value))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="BPI Rank"
                        aValue={comparisonState.teamA.bpi_rank}
                        bValue={comparisonState.teamB.bpi_rank}
                        formatter={(value) => (value === null ? "—" : String(value))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="NET Rank"
                        aValue={comparisonState.teamA.net_rank}
                        bValue={comparisonState.teamB.net_rank}
                        formatter={(value) => (value === null ? "—" : String(value))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Off Efficiency"
                        aValue={comparisonState.teamA.off_efficiency}
                        bValue={comparisonState.teamB.off_efficiency}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="Def Efficiency"
                        aValue={comparisonState.teamA.def_efficiency}
                        bValue={comparisonState.teamB.def_efficiency}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="lower"
                      />
                      <CompareMetricRow
                        label="Adj Tempo"
                        aValue={comparisonState.teamA.adj_tempo}
                        bValue={comparisonState.teamB.adj_tempo}
                        formatter={(value) => (value === null ? "—" : value.toFixed(1))}
                        betterDirection="higher"
                      />
                      <CompareMetricRow
                        label="SOS Net Rating"
                        aValue={comparisonState.teamA.sos_net_rating}
                        bValue={comparisonState.teamB.sos_net_rating}
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

      <section className="mb-4 md:hidden">
        <div className="space-y-3">
          {filteredAndSortedTeams.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-slate-500 shadow-sm">
              No teams matched your search.
            </div>
          ) : (
            filteredAndSortedTeams.map((team) => {
              const compositeRank = getCompositeRankDisplay(team);
              const isExpanded = expandedTeamId === team.id;

              return (
                <div
                  key={team.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTeamId((current) =>
                        current === team.id ? null : team.id
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <TeamLogo teamName={team.school_name} size={28} />
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-900">
                          {team.school_name}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {team.seed} Seed • {team.region} • {team.record ?? "—"}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-700">
                          Composite {compositeRank === null ? "—" : compositeRank.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-lg text-slate-500">
                      {isExpanded ? "▴" : "▾"}
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <MobileMetric label="KenPom" value={formatRank(team.kenpom_rank)} />
                        <MobileMetric label="BPI" value={formatRank(team.bpi_rank)} />
                        <MobileMetric label="NET" value={formatRank(team.net_rank)} />
                        <MobileMetric label="Value" value={team.value_score == null ? "—" : team.value_score.toFixed(1)} />
                        <MobileMetric label="Risk" value={team.risk_score == null ? "—" : team.risk_score.toFixed(1)} />
                        <MobileMetric label="Upset" value={team.upset_score == null ? "—" : team.upset_score.toFixed(1)} />
                        <MobileMetric label="Contender" value={team.contender_score == null ? "—" : team.contender_score.toFixed(1)} />
                        <MobileMetric label="Off Eff" value={formatMetric(team.off_efficiency)} />
                        <MobileMetric label="Def Eff" value={formatMetric(team.def_efficiency)} />
                        <MobileMetric label="Adj Tempo" value={formatMetric(team.adj_tempo)} />
                        <MobileMetric label="Quad 1" value={team.quad1_record ?? "—"} />
                        <MobileMetric label="Quad 2" value={team.quad2_record ?? "—"} />
                      </div>

                      <div className="mt-4">
                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                          Archetypes
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {team.archetype_tags && team.archetype_tags.length > 0 ? (
                            team.archetype_tags.map((tag) => (
                              <ArchetypeTag key={tag} tag={tag} />
                            ))
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-[2050px] w-full text-sm">
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
                    label="Contender"
                    sortKey="contender_score"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-white">
                  Archetypes
                </th>
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
                  const compositeRank = getCompositeRankDisplay(team);

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

                      <td className="px-4 py-3 text-right text-slate-700">
                        {team.value_score === null || team.value_score === undefined
                          ? "—"
                          : team.value_score.toFixed(1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {team.risk_score === null || team.risk_score === undefined
                          ? "—"
                          : team.risk_score.toFixed(1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {team.upset_score === null || team.upset_score === undefined
                          ? "—"
                          : team.upset_score.toFixed(1)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-700">
                        {team.contender_score === null || team.contender_score === undefined
                          ? "—"
                          : team.contender_score.toFixed(1)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {team.archetype_tags && team.archetype_tags.length > 0 ? (
                            team.archetype_tags.map((tag) => (
                              <ArchetypeTag key={tag} tag={tag} />
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