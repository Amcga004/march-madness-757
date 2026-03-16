"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSnakeDraftOrder } from "@/lib/draft";
import { getCanonicalTeamName, getTeamSearchTerms } from "@/lib/teamIdentity";
import {
  getCompositeRank,
  getValueScore,
  getPickGrade,
  type TeamIntelligenceInput,
} from "@/lib/teamIntelligence";
import ManagerBadge from "../components/ManagerBadge";
import TeamLogo from "../components/TeamLogo";
import DraftPickBanner from "../components/draft/DraftPickBanner";
import DraftConfirmationModal from "../components/draft/DraftConfirmationModal";
import DraftBoardGrid from "../components/draft/DraftBoardGrid";

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
};

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
  adj_tempo: number | null;
  sos_net_rating: number | null;
  quad1_record: string | null;
  quad2_record: string | null;
};

type Pick = {
  id: string;
  overall_pick: number;
  snake_round: number;
  member_id: string;
  team_id: string;
};

type League = {
  id: string;
  name: string;
};

type DraftBoardPick = {
  id: string;
  pick_number: number;
  round_number: number;
  manager_name: string;
  team_name: string;
};

type LotteryRevealSlot = 1 | 2 | 3 | 4;

type PickWithMetrics = Pick & {
  owner: string;
  teamName: string;
  seed: number | null;
  region: string;
  compositeRank: number | null;
  valueScore: number | null;
  offEfficiency: number | null;
  defEfficiency: number | null;
  gradeNumeric: number | null;
  gradeLetter: string;
  gradeRationale: string;
};

const MANAGER_BANNER_COLOR_MAP: Record<string, string> = {
  Andrew: "bg-blue-600 text-white",
  Wesley: "bg-green-600 text-white",
  Eric: "bg-purple-600 text-white",
  Greg: "bg-orange-500 text-white",
};

function formatMetric(value: number | null) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatComposite(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toFixed(2);
}

function formatGradeScore(value: number | null) {
  if (value === null || value === undefined) return "—";
  return value.toFixed(1);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toTeamIntelligenceInput(team: Team): TeamIntelligenceInput {
  return {
    school_name: team.school_name,
    seed: team.seed,
    kenpom_rank: team.kenpom_rank,
    bpi_rank: team.bpi_rank,
    net_rank: team.net_rank,
    off_efficiency: team.off_efficiency,
    def_efficiency: team.def_efficiency,
    adj_tempo: team.adj_tempo,
    sos_net_rating: team.sos_net_rating,
    quad1_record: team.quad1_record,
    quad2_record: team.quad2_record,
  };
}

function GradeBadge({
  grade,
  score,
}: {
  grade: string;
  score: number | null;
}) {
  let className =
    "border-slate-200 bg-slate-50 text-slate-700";

  if (grade.startsWith("A")) {
    className = "border-emerald-200 bg-emerald-50 text-emerald-700";
  } else if (grade.startsWith("B")) {
    className = "border-blue-200 bg-blue-50 text-blue-700";
  } else if (grade.startsWith("C")) {
    className = "border-amber-200 bg-amber-50 text-amber-700";
  } else if (grade.startsWith("D") || grade === "F") {
    className = "border-red-200 bg-red-50 text-red-700";
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      <span>{grade}</span>
      <span className="opacity-80">{formatGradeScore(score)}</span>
    </div>
  );
}

function BestAvailableList({
  title,
  subtitle,
  teams,
  valueFormatter,
}: {
  title: string;
  subtitle: string;
  teams: Team[];
  valueFormatter: (team: Team) => string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-4 space-y-3">
        {teams.length === 0 ? (
          <div className="rounded-xl border p-4 text-sm text-slate-600">
            No teams available.
          </div>
        ) : (
          teams.map((team, index) => (
            <div key={team.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <TeamLogo teamName={team.school_name} size={28} />
                  <div>
                    <div className="font-semibold">
                      #{index + 1} {team.school_name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {team.seed} Seed • {team.region} • Record {team.record ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Metric
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {valueFormatter(team)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function DraftPage() {
  const supabase = useMemo(() => createClient(), []);

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [message, setMessage] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  const [pendingPickTeamId, setPendingPickTeamId] = useState<string | null>(null);
  const [pendingPickTeamName, setPendingPickTeamName] = useState("");
  const [isSubmittingPick, setIsSubmittingPick] = useState(false);

  const [isRunningLottery, setIsRunningLottery] = useState(false);
  const [lotteryResults, setLotteryResults] = useState<Partial<Record<LotteryRevealSlot, Member>>>(
    {}
  );
  const [lotteryStatus, setLotteryStatus] = useState("");

  async function loadData() {
    const [
      { data: leagueData },
      { data: memberData },
      { data: teamData },
      { data: pickData },
    ] = await Promise.all([
      supabase
        .from("leagues")
        .select("id,name")
        .eq("public_slug", "2026-757-march-madness-draft")
        .single(),
      supabase
        .from("league_members")
        .select("id,display_name,draft_slot")
        .order("draft_slot", { ascending: true }),
      supabase
        .from("teams")
        .select(
          "id,school_name,seed,region,kenpom_rank,bpi_rank,net_rank,record,conference_record,off_efficiency,def_efficiency,adj_tempo,sos_net_rating,quad1_record,quad2_record"
        )
        .order("region", { ascending: true })
        .order("seed", { ascending: true })
        .order("school_name", { ascending: true }),
      supabase
        .from("picks")
        .select("id,overall_pick,snake_round,member_id,team_id")
        .order("overall_pick", { ascending: true }),
    ]);

    if (leagueData) setLeague(leagueData);
    if (memberData) setMembers(memberData);
    if (teamData) setTeams(teamData);
    if (pickData) setPicks(pickData);
  }

  useEffect(() => {
    loadData();
  }, [supabase]);

  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.draft_slot - b.draft_slot);
  }, [members]);

  const draftOrder = useMemo(() => {
    return orderedMembers.map((m) => m.display_name);
  }, [orderedMembers]);

  const snake = useMemo(() => {
    if (draftOrder.length !== 4) return [];
    return getSnakeDraftOrder(draftOrder);
  }, [draftOrder]);

  const nextOverallPick = picks.length + 1;
  const currentPick = snake.find((pick) => pick.overallPick === nextOverallPick);

  const currentMember = orderedMembers.find(
    (m) => m.display_name === currentPick?.player
  );

  const normalizedTeams = teams.map((team) => ({
    ...team,
    school_name: getCanonicalTeamName(team.school_name),
  }));

  const draftedTeamIds = new Set(picks.map((pick) => pick.team_id));
  const availableTeams = normalizedTeams.filter((team) => !draftedTeamIds.has(team.id));

  const filteredAvailableTeams = availableTeams.filter((team) => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) return true;

    const searchable = [
      ...getTeamSearchTerms(team.school_name),
      team.region,
      String(team.seed),
      team.record ?? "",
      team.conference_record ?? "",
      team.kenpom_rank ? `kenpom ${team.kenpom_rank}` : "",
      team.bpi_rank ? `bpi ${team.bpi_rank}` : "",
      team.net_rank ? `net ${team.net_rank}` : "",
    ].map((value) => value.toLowerCase());

    return searchable.some((value) => value.includes(query));
  });

  const memberMap = new Map(members.map((m) => [m.id, m.display_name]));
  const teamMap = new Map(normalizedTeams.map((t) => [t.id, t]));

  const completedPicks = useMemo<PickWithMetrics[]>(() => {
    return picks.map((pick) => {
      const team = teamMap.get(pick.team_id);

      const intelligenceInput = team ? toTeamIntelligenceInput(team) : null;
      const compositeRank = intelligenceInput ? getCompositeRank(intelligenceInput) : null;
      const valueScore = intelligenceInput ? getValueScore(intelligenceInput) : null;
      const pickGrade = intelligenceInput
        ? getPickGrade(intelligenceInput)
        : { numeric_score: null, grade: "—", rationale: "Insufficient data" };

      return {
        ...pick,
        owner: memberMap.get(pick.member_id) ?? "Unknown",
        teamName: team?.school_name ?? "Unknown Team",
        seed: team?.seed ?? null,
        region: team?.region ?? "",
        compositeRank,
        valueScore,
        offEfficiency: team?.off_efficiency ?? null,
        defEfficiency: team?.def_efficiency ?? null,
        gradeNumeric: pickGrade.numeric_score,
        gradeLetter: pickGrade.grade,
        gradeRationale: pickGrade.rationale,
      };
    });
  }, [picks, teamMap, memberMap]);

  const currentManagerName = currentMember?.display_name ?? "Current Manager";
  const totalPicks = snake.length || normalizedTeams.length || 64;
  const currentRoundLabel = currentPick ? `Round ${currentPick.round}` : undefined;

  const draftBoardPicks = useMemo<DraftBoardPick[]>(() => {
    return completedPicks.map((pick) => ({
      id: pick.id,
      pick_number: pick.overall_pick,
      round_number: pick.snake_round,
      manager_name: pick.owner,
      team_name: pick.teamName,
    }));
  }, [completedPicks]);

  const selectedTeam = useMemo(() => {
    return normalizedTeams.find((team) => team.id === selectedTeamId) ?? null;
  }, [normalizedTeams, selectedTeamId]);

  const selectedTeamGrade = useMemo(() => {
    if (!selectedTeam) return null;
    return getPickGrade(toTeamIntelligenceInput(selectedTeam));
  }, [selectedTeam]);

  const lotteryDisplayOrder: LotteryRevealSlot[] = [4, 3, 2, 1];
  const lotteryLocked = picks.length > 0;

  const bestAvailableOverall = useMemo(() => {
    return [...availableTeams]
      .filter((team) => getCompositeRank(toTeamIntelligenceInput(team)) !== null)
      .sort(
        (a, b) =>
          (getCompositeRank(toTeamIntelligenceInput(a)) ?? 9999) -
          (getCompositeRank(toTeamIntelligenceInput(b)) ?? 9999)
      )
      .slice(0, 5);
  }, [availableTeams]);

  const bestValueRemaining = useMemo(() => {
    return [...availableTeams]
      .filter((team) => getValueScore(toTeamIntelligenceInput(team)) !== null)
      .sort(
        (a, b) =>
          (getValueScore(toTeamIntelligenceInput(b)) ?? -9999) -
          (getValueScore(toTeamIntelligenceInput(a)) ?? -9999)
      )
      .slice(0, 5);
  }, [availableTeams]);

  const bestOffenseRemaining = useMemo(() => {
    return [...availableTeams]
      .filter((team) => team.off_efficiency !== null)
      .sort((a, b) => (b.off_efficiency ?? -9999) - (a.off_efficiency ?? -9999))
      .slice(0, 5);
  }, [availableTeams]);

  const bestDefenseRemaining = useMemo(() => {
    return [...availableTeams]
      .filter((team) => team.def_efficiency !== null)
      .sort((a, b) => (a.def_efficiency ?? 9999) - (b.def_efficiency ?? 9999))
      .slice(0, 5);
  }, [availableTeams]);

  const bestDraftedPick = useMemo(() => {
    return (
      [...completedPicks]
        .filter((pick) => pick.compositeRank !== null)
        .sort((a, b) => (a.compositeRank ?? 9999) - (b.compositeRank ?? 9999))[0] ?? null
    );
  }, [completedPicks]);

  const bestValueDraftedPick = useMemo(() => {
    return (
      [...completedPicks]
        .filter((pick) => pick.valueScore !== null)
        .sort((a, b) => (b.valueScore ?? -9999) - (a.valueScore ?? -9999))[0] ?? null
    );
  }, [completedPicks]);

  const biggestReachPick = useMemo(() => {
    return (
      [...completedPicks]
        .filter((pick) => pick.valueScore !== null)
        .sort((a, b) => (a.valueScore ?? 9999) - (b.valueScore ?? 9999))[0] ?? null
    );
  }, [completedPicks]);

  const highestGradedPick = useMemo(() => {
    return (
      [...completedPicks]
        .filter((pick) => pick.gradeNumeric !== null)
        .sort((a, b) => (b.gradeNumeric ?? -9999) - (a.gradeNumeric ?? -9999))[0] ?? null
    );
  }, [completedPicks]);

  const lowestGradedPick = useMemo(() => {
    return (
      [...completedPicks]
        .filter((pick) => pick.gradeNumeric !== null)
        .sort((a, b) => (a.gradeNumeric ?? 9999) - (b.gradeNumeric ?? 9999))[0] ?? null
    );
  }, [completedPicks]);

  const bestRemainingTeam = bestAvailableOverall[0] ?? null;

  const managerRecap = useMemo(() => {
    return orderedMembers.map((member) => {
      const memberPicks = completedPicks.filter((pick) => pick.member_id === member.id);

      const compositeValues = memberPicks
        .map((pick) => pick.compositeRank)
        .filter((value): value is number => value !== null && value !== undefined);

      const seedValues = memberPicks
        .map((pick) => pick.seed)
        .filter((value): value is number => value !== null && value !== undefined);

      const gradeValues = memberPicks
        .map((pick) => pick.gradeNumeric)
        .filter((value): value is number => value !== null && value !== undefined);

      const avgComposite = average(compositeValues);
      const avgSeed = average(seedValues);
      const avgGrade = average(gradeValues);

      const bestPick =
        [...memberPicks]
          .filter((pick) => pick.gradeNumeric !== null)
          .sort((a, b) => (b.gradeNumeric ?? -9999) - (a.gradeNumeric ?? -9999))[0] ?? null;

      return {
        id: member.id,
        name: member.display_name,
        totalPicks: memberPicks.length,
        avgComposite,
        avgSeed,
        avgGrade,
        bestPick,
      };
    });
  }, [orderedMembers, completedPicks]);

  async function refreshPicks() {
    const { data: pickData } = await supabase
      .from("picks")
      .select("id,overall_pick,snake_round,member_id,team_id")
      .order("overall_pick", { ascending: true });

    if (pickData) setPicks(pickData);
  }

  async function runDraftLottery() {
    if (isRunningLottery) return;

    if (members.length !== 4) {
      setLotteryStatus("Lottery requires exactly 4 managers.");
      return;
    }

    if (picks.length > 0) {
      setLotteryStatus("Draft order cannot be randomized after picks have been made.");
      return;
    }

    const confirmed = window.confirm(
      "Run the draft lottery and overwrite the current draft order?"
    );
    if (!confirmed) return;

    setIsRunningLottery(true);
    setLotteryResults({});
    setLotteryStatus("Starting lottery...");

    try {
      const shuffled = [...members]
        .map((member) => ({ member, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((entry) => entry.member);

      const finalOrder = [...shuffled].reverse();

      const revealMap: Partial<Record<LotteryRevealSlot, Member>> = {};

      for (let i = 0; i < shuffled.length; i += 1) {
        const revealSlot = lotteryDisplayOrder[i];
        const revealedMember = shuffled[i];

        setLotteryStatus(`Revealing pick #${revealSlot}...`);
        revealMap[revealSlot] = revealedMember;
        setLotteryResults({ ...revealMap });

        if (i < shuffled.length - 1) {
          await wait(2000);
        }
      }

      setLotteryStatus("Saving draft order...");

      for (let i = 0; i < finalOrder.length; i += 1) {
        const member = finalOrder[i];

        const { error } = await supabase
          .from("league_members")
          .update({ draft_slot: i + 1 })
          .eq("id", member.id);

        if (error) {
          throw new Error(error.message || "Failed to update draft order.");
        }
      }

      await loadData();
      setLotteryStatus("Draft lottery complete.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Draft lottery failed.";
      setLotteryStatus(message);
    } finally {
      setIsRunningLottery(false);
    }
  }

  async function submitDraftPick(teamId: string) {
    if (!league || !currentMember || !currentPick || !teamId) {
      setMessage("Missing required draft information.");
      return false;
    }

    setMessage("Saving pick...");

    const response = await fetch("/api/make-pick", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leagueId: league.id,
        memberId: currentMember.id,
        teamId,
        overallPick: currentPick.overallPick,
        snakeRound: currentPick.round,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      setMessage(result.error || "Failed to save pick.");
      return false;
    }

    await refreshPicks();
    setSelectedTeamId("");
    setTeamSearch("");
    setMessage("Pick saved.");
    return true;
  }

  async function handleDraftPick(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedTeamId) {
      setMessage("Please select a team.");
      return;
    }

    const selectedTeam = normalizedTeams.find((team) => team.id === selectedTeamId);

    setPendingPickTeamId(selectedTeamId);
    setPendingPickTeamName(selectedTeam?.school_name ?? "Selected Team");
  }

  async function confirmDraftPick() {
    if (!pendingPickTeamId) return;

    setIsSubmittingPick(true);

    try {
      const ok = await submitDraftPick(pendingPickTeamId);

      if (ok) {
        setPendingPickTeamId(null);
        setPendingPickTeamName("");
      }
    } finally {
      setIsSubmittingPick(false);
    }
  }

  async function undoLastPick() {
    const confirmed = window.confirm("Undo the most recent draft pick?");
    if (!confirmed) return;

    setMessage("Reversing last pick...");

    const res = await fetch("/api/undo-last-pick", {
      method: "POST",
    });

    const result = await res.json();

    if (!result.ok) {
      setMessage(result.error || "Undo failed.");
      return;
    }

    await refreshPicks();
    setMessage("Last pick removed.");
  }

  const upcomingPicks = snake
    .filter((pick) => pick.overallPick >= nextOverallPick)
    .slice(0, 10);

  const recentlyCompleted = [...completedPicks].reverse().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <section className="mb-6 sm:mb-8">
        <h2 className="text-3xl font-bold">Draft Room</h2>
        <p className="mt-2 text-gray-600">
          Live commissioner-controlled snake draft.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Draft Lottery
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                Randomize Draft Order
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Equal odds for all four managers. The reveal runs 4th, 3rd, 2nd,
                then 1st with a two-second delay between each result.
              </div>
            </div>

            <button
              type="button"
              onClick={runDraftLottery}
              disabled={isRunningLottery || lotteryLocked || members.length !== 4}
              className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunningLottery ? "Running Lottery..." : "Run Draft Lottery"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {orderedMembers.map((member) => (
              <div key={member.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current Slot
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <ManagerBadge name={member.display_name} />
                  <div className="text-lg font-bold text-slate-900">#{member.draft_slot}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {lotteryDisplayOrder.map((slot) => {
              const revealedMember = lotteryResults[slot];

              return (
                <div
                  key={slot}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    Lottery Reveal
                  </div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    Pick #{slot}
                  </div>
                  <div className="mt-3">
                    {revealedMember ? (
                      <ManagerBadge name={revealedMember.display_name} />
                    ) : (
                      <span className="text-sm text-slate-500">Waiting...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {lotteryStatus ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {lotteryStatus}
            </div>
          ) : null}

          {lotteryLocked ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Draft lottery is locked once picks have been made.
            </div>
          ) : null}
        </div>
      </section>

      {currentPick && currentMember ? (
        <div className="mb-6 sm:mb-8">
          <DraftPickBanner
            currentPickNumber={currentPick.overallPick}
            totalPicks={totalPicks}
            currentManagerName={currentManagerName}
            roundLabel={currentRoundLabel}
            managerColorClass={MANAGER_BANNER_COLOR_MAP[currentManagerName]}
          />
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
        {currentPick && currentMember ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                On the Clock
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ManagerBadge name={currentMember.display_name} />
                <span className="text-2xl font-bold">{currentMember.display_name}</span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Pick #{currentPick.overallPick} • Round {currentPick.round}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-4">
                <div className="text-sm text-gray-500">Completed Picks</div>
                <div className="mt-1 text-2xl font-bold">{picks.length}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-sm text-gray-500">Taken Teams</div>
                <div className="mt-1 text-2xl font-bold">{draftedTeamIds.size}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-sm text-gray-500">Remaining Teams</div>
                <div className="mt-1 text-2xl font-bold">{availableTeams.length}</div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Draft Status
            </div>
            <div className="mt-2 text-2xl font-bold">Draft Complete</div>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-semibold">Make Current Pick</h3>

            {currentPick && currentMember ? (
              <>
                <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
                  <div className="text-sm text-gray-500">Current Pick</div>
                  <div className="mt-1 text-lg font-semibold">
                    Pick #{currentPick.overallPick}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ManagerBadge name={currentMember.display_name} />
                    <span className="text-sm text-gray-600">
                      {currentMember.display_name} is selecting now
                    </span>
                  </div>
                </div>

                <form onSubmit={handleDraftPick} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Search Teams</label>
                    <input
                      type="text"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Search by school, alias, region, seed, or ranking"
                      className="w-full rounded-xl border px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Select Team</label>
                    <select
                      className="w-full rounded-xl border px-3 py-2"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      required
                    >
                      <option value="">Choose a team</option>
                      {filteredAvailableTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.school_name} • {team.seed} Seed • {team.region} • KP {team.kenpom_rank ?? "—"} • BPI {team.bpi_rank ?? "—"} • NET {team.net_rank ?? "—"} • {team.record ?? "No Record"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTeam ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <TeamLogo teamName={selectedTeam.school_name} size={34} />
                        <div>
                          <div className="text-lg font-semibold">{selectedTeam.school_name}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {selectedTeam.seed} Seed • {selectedTeam.region}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border bg-white p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Rankings
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            KenPom: <span className="font-semibold">{selectedTeam.kenpom_rank ?? "—"}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            BPI: <span className="font-semibold">{selectedTeam.bpi_rank ?? "—"}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            NET: <span className="font-semibold">{selectedTeam.net_rank ?? "—"}</span>
                          </div>
                        </div>

                        <div className="rounded-xl border bg-white p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Record
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            Overall: <span className="font-semibold">{selectedTeam.record ?? "—"}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            Conference: <span className="font-semibold">{selectedTeam.conference_record ?? "—"}</span>
                          </div>
                        </div>

                        <div className="rounded-xl border bg-white p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Efficiency
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            Off: <span className="font-semibold">{formatMetric(selectedTeam.off_efficiency)}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            Def: <span className="font-semibold">{formatMetric(selectedTeam.def_efficiency)}</span>
                          </div>
                        </div>

                        <div className="rounded-xl border bg-white p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Draft Signal
                          </div>
                          <div className="mt-2 text-sm text-slate-700">
                            Composite: <span className="font-semibold">{formatComposite(getCompositeRank(toTeamIntelligenceInput(selectedTeam)))}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            Value Score: <span className="font-semibold">{formatComposite(getValueScore(toTeamIntelligenceInput(selectedTeam)))}</span>
                          </div>
                          <div className="mt-2">
                            <GradeBadge
                              grade={selectedTeamGrade?.grade ?? "—"}
                              score={selectedTeamGrade?.numeric_score ?? null}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {teamSearch && filteredAvailableTeams.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      No teams match your search.
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-black px-4 py-2 text-white sm:w-auto"
                    >
                      Draft Team
                    </button>

                    <button
                      type="button"
                      onClick={undoLastPick}
                      className="w-full rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 sm:w-auto"
                    >
                      Undo Last Pick
                    </button>
                  </div>

                  {message ? <p className="text-sm text-gray-600">{message}</p> : null}
                </form>
              </>
            ) : (
              <div className="mt-4 rounded-xl border p-4 text-sm text-gray-600">
                No further picks are needed.
              </div>
            )}
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <BestAvailableList
              title="Best Available Overall"
              subtitle="Top remaining teams by composite rank"
              teams={bestAvailableOverall}
              valueFormatter={(team) =>
                `Composite ${formatComposite(getCompositeRank(toTeamIntelligenceInput(team)))}`
              }
            />

            <BestAvailableList
              title="Best Value Remaining"
              subtitle="Biggest positive gap between seed expectation and composite rank"
              teams={bestValueRemaining}
              valueFormatter={(team) =>
                `Value ${formatComposite(getValueScore(toTeamIntelligenceInput(team)))}`
              }
            />

            <BestAvailableList
              title="Best Offense Remaining"
              subtitle="Top remaining teams by offensive efficiency"
              teams={bestOffenseRemaining}
              valueFormatter={(team) => `Off Eff ${formatMetric(team.off_efficiency)}`}
            />

            <BestAvailableList
              title="Best Defense Remaining"
              subtitle="Top remaining teams by defensive efficiency"
              teams={bestDefenseRemaining}
              valueFormatter={(team) => `Def Eff ${formatMetric(team.def_efficiency)}`}
            />
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-semibold">Upcoming Picks</h3>

            <div className="mt-4 space-y-3">
              {upcomingPicks.length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-gray-600">
                  No upcoming picks remaining.
                </div>
              ) : (
                upcomingPicks.map((pick, index) => (
                  <div
                    key={pick.overallPick}
                    className={`rounded-xl border p-4 ${
                      index === 0 ? "border-slate-900 bg-slate-100" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold">Pick #{pick.overallPick}</div>
                        <div className="mt-1 text-sm text-gray-600">
                          Round {pick.round}
                        </div>
                      </div>
                      <div className="self-start sm:self-auto">
                        <ManagerBadge name={pick.player} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DraftBoardGrid picks={draftBoardPicks} />

          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-semibold">Draft Recap</h3>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Picks Made
                </div>
                <div className="mt-2 text-2xl font-bold">{picks.length}</div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Best Pick Drafted
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {bestDraftedPick ? bestDraftedPick.teamName : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {bestDraftedPick
                    ? `Composite ${formatComposite(bestDraftedPick.compositeRank)}`
                    : "No picks yet"}
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Best Value Drafted
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {bestValueDraftedPick ? bestValueDraftedPick.teamName : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {bestValueDraftedPick
                    ? `Value ${formatComposite(bestValueDraftedPick.valueScore)}`
                    : "No picks yet"}
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Best Remaining Team
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {bestRemainingTeam ? bestRemainingTeam.school_name : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {bestRemainingTeam
                    ? `Composite ${formatComposite(getCompositeRank(toTeamIntelligenceInput(bestRemainingTeam)))}`
                    : "Draft complete"}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Highest Graded Pick
                </div>
                {highestGradedPick ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <TeamLogo teamName={highestGradedPick.teamName} size={30} />
                      <div>
                        <div className="font-semibold">
                          Pick #{highestGradedPick.overall_pick} • {highestGradedPick.teamName}
                        </div>
                        <div className="text-sm text-slate-600">
                          {highestGradedPick.owner}
                        </div>
                      </div>
                    </div>
                    <GradeBadge
                      grade={highestGradedPick.gradeLetter}
                      score={highestGradedPick.gradeNumeric}
                    />
                    <div className="text-sm text-slate-500">
                      {highestGradedPick.gradeRationale}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-600">No picks yet.</div>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Lowest Graded Pick
                </div>
                {lowestGradedPick ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <TeamLogo teamName={lowestGradedPick.teamName} size={30} />
                      <div>
                        <div className="font-semibold">
                          Pick #{lowestGradedPick.overall_pick} • {lowestGradedPick.teamName}
                        </div>
                        <div className="text-sm text-slate-600">
                          {lowestGradedPick.owner}
                        </div>
                      </div>
                    </div>
                    <GradeBadge
                      grade={lowestGradedPick.gradeLetter}
                      score={lowestGradedPick.gradeNumeric}
                    />
                    <div className="text-sm text-slate-500">
                      {lowestGradedPick.gradeRationale}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-600">No picks yet.</div>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Biggest Reach So Far
                </div>
                {biggestReachPick ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <TeamLogo teamName={biggestReachPick.teamName} size={30} />
                      <div>
                        <div className="font-semibold">
                          Pick #{biggestReachPick.overall_pick} • {biggestReachPick.teamName}
                        </div>
                        <div className="text-sm text-slate-600">
                          {biggestReachPick.owner} • Value {formatComposite(biggestReachPick.valueScore)}
                        </div>
                      </div>
                    </div>
                    <GradeBadge
                      grade={biggestReachPick.gradeLetter}
                      score={biggestReachPick.gradeNumeric}
                    />
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-600">No picks yet.</div>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Strongest Analytic Pick So Far
                </div>
                {bestDraftedPick ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <TeamLogo teamName={bestDraftedPick.teamName} size={30} />
                      <div>
                        <div className="font-semibold">
                          Pick #{bestDraftedPick.overall_pick} • {bestDraftedPick.teamName}
                        </div>
                        <div className="text-sm text-slate-600">
                          {bestDraftedPick.owner} • Composite {formatComposite(bestDraftedPick.compositeRank)}
                        </div>
                      </div>
                    </div>
                    <GradeBadge
                      grade={bestDraftedPick.gradeLetter}
                      score={bestDraftedPick.gradeNumeric}
                    />
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-600">No picks yet.</div>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {managerRecap.map((manager) => (
                <div key={manager.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <ManagerBadge name={manager.name} />
                      <div>
                        <div className="font-semibold text-slate-900">{manager.name}</div>
                        <div className="text-sm text-slate-600">
                          {manager.totalPicks} picks made
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[680px]">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Avg Composite
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {formatComposite(manager.avgComposite)}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Avg Seed
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {manager.avgSeed === null ? "—" : manager.avgSeed.toFixed(2)}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Avg Grade
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {formatGradeScore(manager.avgGrade)}
                        </div>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          Best Graded Pick
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {manager.bestPick ? manager.bestPick.teamName : "—"}
                        </div>
                        {manager.bestPick ? (
                          <div className="mt-2">
                            <GradeBadge
                              grade={manager.bestPick.gradeLetter}
                              score={manager.bestPick.gradeNumeric}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-xl font-semibold">Recently Completed Picks</h3>

            <div className="mt-4 space-y-3">
              {recentlyCompleted.length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-gray-600">
                  No picks made yet.
                </div>
              ) : (
                recentlyCompleted.map((pick) => (
                  <div key={pick.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <TeamLogo teamName={pick.teamName} size={30} />
                        <div>
                          <div className="font-semibold">
                            Pick #{pick.overall_pick} • {pick.teamName}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {pick.seed ? `${pick.seed} Seed • ` : ""}
                            {pick.region}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            Composite {formatComposite(pick.compositeRank)} • Value {formatComposite(pick.valueScore)}
                          </div>
                          <div className="mt-2">
                            <GradeBadge
                              grade={pick.gradeLetter}
                              score={pick.gradeNumeric}
                            />
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {pick.gradeRationale}
                          </div>
                        </div>
                      </div>
                      <div className="self-start sm:self-auto">
                        <ManagerBadge name={pick.owner} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <DraftConfirmationModal
        isOpen={!!pendingPickTeamId}
        teamName={pendingPickTeamName}
        managerName={currentManagerName}
        isSubmitting={isSubmittingPick}
        onCancel={() => {
          if (isSubmittingPick) return;
          setPendingPickTeamId(null);
          setPendingPickTeamName("");
        }}
        onConfirm={confirmDraftPick}
      />
    </div>
  );
}