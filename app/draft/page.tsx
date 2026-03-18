"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSnakeDraftOrder } from "@/lib/draft";
import { getCanonicalTeamName, getTeamSearchTerms } from "@/lib/teamIdentity";
import ManagerBadge from "../components/ManagerBadge";
import TeamLogo from "../components/TeamLogo";
import DraftPickBanner from "../components/draft/DraftPickBanner";
import DraftConfirmationModal from "../components/draft/DraftConfirmationModal";
import DraftBoardGrid from "../components/draft/DraftBoardGrid";

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
  email: string | null;
  role: string | null;
  user_id: string | null;
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
  is_play_in_actual?: boolean;
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

type PickWithMetrics = Pick & {
  owner: string;
  teamName: string;
  seed: number | null;
  region: string;
  compositeRank: number | null;
  valueScore: number | null;
  offEfficiency: number | null;
  defEfficiency: number | null;
};

type AuthUser = {
  id: string;
  email?: string;
} | null;

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

function getCompositeRank(team: Team) {
  const ranks = [team.kenpom_rank, team.bpi_rank, team.net_rank].filter(
    (value): value is number => value !== null && value !== undefined
  );

  if (ranks.length === 0) return null;

  return ranks.reduce((sum, value) => sum + value, 0) / ranks.length;
}

function getExpectedRankFromSeed(seed: number | null) {
  if (seed === null || seed === undefined) return null;
  return (seed - 1) * 4 + 2.5;
}

function getValueScore(team: Team) {
  const composite = getCompositeRank(team);
  const expected = getExpectedRankFromSeed(team.seed);

  if (composite === null || expected === null) return null;

  return expected - composite;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-6 ${className}`}>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
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
    <div className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-6">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{subtitle}</p>

      <div className="mt-4 space-y-3">
        {teams.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4 text-sm text-slate-400">
            No teams available.
          </div>
        ) : (
          teams.map((team, index) => (
            <div key={team.id} className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <TeamLogo teamName={team.school_name} size={28} />
                  <div>
                    <div className="font-semibold text-white">
                      #{index + 1} {team.school_name}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {team.seed} Seed • {team.region} • Record {team.record ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Metric
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
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
  const [authUser, setAuthUser] = useState<AuthUser>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [message, setMessage] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  const [pendingPickTeamId, setPendingPickTeamId] = useState<string | null>(null);
  const [pendingPickTeamName, setPendingPickTeamName] = useState("");
  const [isSubmittingPick, setIsSubmittingPick] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  async function loadData() {
    const [
      { data: authData },
      { data: leagueData },
      { data: memberData },
      { data: teamData },
      { data: pickData },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("leagues")
        .select("id,name")
        .eq("public_slug", "2026-757-march-madness-draft")
        .single(),
      supabase
        .from("league_members")
        .select("id,display_name,draft_slot,email,role,user_id")
        .order("draft_slot", { ascending: true }),
      supabase
        .from("teams")
        .select(
          "id,school_name,seed,region,kenpom_rank,bpi_rank,net_rank,record,conference_record,off_efficiency,def_efficiency,is_play_in_actual"
        )
        .eq("is_play_in_actual", false)
        .order("seed", { ascending: true })
        .order("region", { ascending: true })
        .order("school_name", { ascending: true }),
      supabase
        .from("picks")
        .select("id,overall_pick,snake_round,member_id,team_id")
        .order("overall_pick", { ascending: true }),
    ]);

    setAuthUser(authData.user ? { id: authData.user.id, email: authData.user.email } : null);
    setAuthLoaded(true);

    if (leagueData) setLeague(leagueData);
    if (memberData) setMembers(memberData as Member[]);
    if (teamData) setTeams(teamData as Team[]);
    if (pickData) setPicks(pickData as Pick[]);
  }

  useEffect(() => {
    loadData();
  }, [supabase]);

  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.draft_slot - b.draft_slot);
  }, [members]);

  const signedInMember = useMemo(() => {
    if (!authUser) return null;
    return orderedMembers.find((member) => member.user_id === authUser.id) ?? null;
  }, [orderedMembers, authUser]);

  const canAccessAdmin = signedInMember?.role === "commissioner";

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

      return {
        ...pick,
        owner: memberMap.get(pick.member_id) ?? "Unknown",
        teamName: team?.school_name ?? "Unknown Team",
        seed: team?.seed ?? null,
        region: team?.region ?? "",
        compositeRank: team ? getCompositeRank(team) : null,
        valueScore: team ? getValueScore(team) : null,
        offEfficiency: team?.off_efficiency ?? null,
        defEfficiency: team?.def_efficiency ?? null,
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

  const bestAvailableOverall = useMemo(() => {
    return [...availableTeams]
      .filter((team) => getCompositeRank(team) !== null)
      .sort((a, b) => (getCompositeRank(a) ?? 9999) - (getCompositeRank(b) ?? 9999))
      .slice(0, 5);
  }, [availableTeams]);

  const bestValueRemaining = useMemo(() => {
    return [...availableTeams]
      .filter((team) => getValueScore(team) !== null)
      .sort((a, b) => (getValueScore(b) ?? -9999) - (getValueScore(a) ?? -9999))
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
    return [...completedPicks]
      .filter((pick) => pick.compositeRank !== null)
      .sort((a, b) => (a.compositeRank ?? 9999) - (b.compositeRank ?? 9999))[0] ?? null;
  }, [completedPicks]);

  const bestValueDraftedPick = useMemo(() => {
    return [...completedPicks]
      .filter((pick) => pick.valueScore !== null)
      .sort((a, b) => (b.valueScore ?? -9999) - (a.valueScore ?? -9999))[0] ?? null;
  }, [completedPicks]);

  const biggestReachPick = useMemo(() => {
    return [...completedPicks]
      .filter((pick) => pick.valueScore !== null)
      .sort((a, b) => (a.valueScore ?? 9999) - (b.valueScore ?? 9999))[0] ?? null;
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

      const avgComposite = average(compositeValues);
      const avgSeed = average(seedValues);

      return {
        id: member.id,
        name: member.display_name,
        totalPicks: memberPicks.length,
        avgComposite,
        avgSeed,
        bestPick:
          [...memberPicks]
            .filter((pick) => pick.compositeRank !== null)
            .sort((a, b) => (a.compositeRank ?? 9999) - (b.compositeRank ?? 9999))[0] ?? null,
      };
    });
  }, [orderedMembers, completedPicks]);

  const canMakeCurrentPick =
    !!signedInMember &&
    !!currentMember &&
    signedInMember.id === currentMember.id;

  async function refreshPicks() {
    const { data: pickData } = await supabase
      .from("picks")
      .select("id,overall_pick,snake_round,member_id,team_id")
      .order("overall_pick", { ascending: true });

    if (pickData) setPicks(pickData as Pick[]);
  }

  async function submitDraftPick(teamId: string) {
    if (!league || !currentMember || !currentPick || !teamId || !signedInMember) {
      setMessage("Missing required draft information.");
      return false;
    }

    if (signedInMember.id !== currentMember.id) {
      setMessage("You can only make a pick when it is your turn.");
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

    if (!signedInMember) {
      setMessage("Please sign in from the menu before making a pick.");
      return;
    }

    if (!canMakeCurrentPick) {
      setMessage("You can only make a pick when it is your turn.");
      return;
    }

    if (!selectedTeamId) {
      setMessage("Please select a team.");
      return;
    }

    const selected = normalizedTeams.find((team) => team.id === selectedTeamId);

    setPendingPickTeamId(selectedTeamId);
    setPendingPickTeamName(selected?.school_name ?? "Selected Team");
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
    if (!canAccessAdmin) {
      setMessage("Only the commissioner can undo picks.");
      return;
    }

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
      <section className="mb-5 sm:mb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Draft
        </div>
        <h2 className="mt-1 text-3xl font-bold text-white">Draft Room</h2>
        <p className="mt-2 text-slate-300">
          Live draft room with role-based pick controls and real-time draft tracking.
        </p>
      </section>

      <section className="mb-6 rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:mb-8 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Draft Status
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {authLoaded
                ? signedInMember
                  ? `Signed in as ${signedInMember.display_name} • ${signedInMember.role ?? "manager"}`
                  : authUser
                  ? "Signed in, but not mapped to a league member"
                  : "Not signed in"
                : "Checking session..."}
            </div>
          </div>

          <div className="text-sm text-slate-300">
            {!authUser ? (
              <span>Use the menu to sign in before making picks.</span>
            ) : canAccessAdmin ? (
              <a href="/admin" className="font-medium text-white underline underline-offset-4">
                Commissioner access available
              </a>
            ) : (
              <span>View board and make picks when it is your turn.</span>
            )}
          </div>
        </div>

        {authUser && !signedInMember ? (
          <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Your signed-in account is not mapped to a league member yet, so you can view the board but cannot make picks.
          </div>
        ) : null}
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

      <section className="mb-6 rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:mb-8 sm:p-6">
        {currentPick && currentMember ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                On the Clock
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <ManagerBadge name={currentMember.display_name} />
                <span className="text-2xl font-bold text-white">{currentMember.display_name}</span>
              </div>
              <div className="mt-2 text-sm text-slate-300">
                Pick #{currentPick.overallPick} • Round {currentPick.round}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-200">
                {canMakeCurrentPick
                  ? "It is your turn. You can make this pick."
                  : signedInMember
                  ? "You are signed in, but it is not your turn."
                  : "Sign in from the menu to make picks when it is your turn."}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Completed Picks" value={picks.length} />
              <MetricCard label="Taken Teams" value={draftedTeamIds.size} />
              <MetricCard label="Remaining Teams" value={availableTeams.length} />
            </div>
          </div>
        ) : (
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Draft Status
            </div>
            <div className="mt-2 text-2xl font-bold text-white">Draft Complete</div>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-6">
          <SectionCard title="Make Current Pick">
            {currentPick && currentMember ? (
              <>
                <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                  <div className="text-sm text-slate-400">Current Pick</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    Pick #{currentPick.overallPick}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ManagerBadge name={currentMember.display_name} />
                    <span className="text-sm text-slate-300">
                      {currentMember.display_name} is selecting now
                    </span>
                  </div>
                </div>

                <form onSubmit={handleDraftPick} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Search Teams</label>
                    <input
                      type="text"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Search by school, alias, region, seed, or ranking"
                      className="w-full rounded-2xl border border-slate-600 bg-[#172033] px-3 py-2 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={!canMakeCurrentPick}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Select Team</label>
                    <select
                      className="w-full rounded-2xl border border-slate-600 bg-[#172033] px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      required
                      disabled={!canMakeCurrentPick}
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
                    <div className="rounded-3xl border border-slate-700/80 bg-[#172033] p-4">
                      <div className="flex items-start gap-3">
                        <TeamLogo teamName={selectedTeam.school_name} size={34} />
                        <div>
                          <div className="text-lg font-semibold text-white">{selectedTeam.school_name}</div>
                          <div className="mt-1 text-sm text-slate-300">
                            {selectedTeam.seed} Seed • {selectedTeam.region}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-slate-700/80 bg-[#111827] p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Rankings
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            KenPom: <span className="font-semibold text-white">{selectedTeam.kenpom_rank ?? "—"}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            BPI: <span className="font-semibold text-white">{selectedTeam.bpi_rank ?? "—"}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            NET: <span className="font-semibold text-white">{selectedTeam.net_rank ?? "—"}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700/80 bg-[#111827] p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Record
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            Overall: <span className="font-semibold text-white">{selectedTeam.record ?? "—"}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            Conference: <span className="font-semibold text-white">{selectedTeam.conference_record ?? "—"}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700/80 bg-[#111827] p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Efficiency
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            Off: <span className="font-semibold text-white">{formatMetric(selectedTeam.off_efficiency)}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            Def: <span className="font-semibold text-white">{formatMetric(selectedTeam.def_efficiency)}</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700/80 bg-[#111827] p-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Draft Signal
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            Composite: <span className="font-semibold text-white">{formatComposite(getCompositeRank(selectedTeam))}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            Value Score: <span className="font-semibold text-white">{formatComposite(getValueScore(selectedTeam))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {teamSearch && filteredAvailableTeams.length === 0 ? (
                    <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-3 text-sm text-slate-400">
                      No teams match your search.
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={!canMakeCurrentPick}
                      className="w-full rounded-2xl bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      Draft Team
                    </button>

                    {canAccessAdmin ? (
                      <button
                        type="button"
                        onClick={undoLastPick}
                        className="w-full rounded-2xl border border-red-500/40 px-4 py-2 text-red-200 transition hover:bg-red-500/10 sm:w-auto"
                      >
                        Undo Last Pick
                      </button>
                    ) : null}
                  </div>

                  {message ? <p className="text-sm text-slate-300">{message}</p> : null}
                </form>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4 text-sm text-slate-400">
                No further picks are needed.
              </div>
            )}
          </SectionCard>

          <div className="grid gap-6 2xl:grid-cols-2">
            <BestAvailableList
              title="Best Available Overall"
              subtitle="Top remaining teams by composite rank"
              teams={bestAvailableOverall}
              valueFormatter={(team) => `Composite ${formatComposite(getCompositeRank(team))}`}
            />

            <BestAvailableList
              title="Best Value Remaining"
              subtitle="Biggest positive gap between seed expectation and composite rank"
              teams={bestValueRemaining}
              valueFormatter={(team) => `Value ${formatComposite(getValueScore(team))}`}
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

          <SectionCard title="Upcoming Picks">
            <div className="space-y-3">
              {upcomingPicks.length === 0 ? (
                <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4 text-sm text-slate-400">
                  No upcoming picks remaining.
                </div>
              ) : (
                upcomingPicks.map((pick, index) => (
                  <div
                    key={pick.overallPick}
                    className={`rounded-2xl border p-4 ${
                      index === 0
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-slate-700/80 bg-[#172033]"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-white">Pick #{pick.overallPick}</div>
                        <div className="mt-1 text-sm text-slate-400">
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
          </SectionCard>

          <DraftBoardGrid picks={draftBoardPicks} />

          <SectionCard title="Draft Recap">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Picks Made
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{picks.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Best Pick Drafted
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {bestDraftedPick ? bestDraftedPick.teamName : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {bestDraftedPick
                    ? `Composite ${formatComposite(bestDraftedPick.compositeRank)}`
                    : "No picks yet"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Best Value Drafted
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {bestValueDraftedPick ? bestValueDraftedPick.teamName : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {bestValueDraftedPick
                    ? `Value ${formatComposite(bestValueDraftedPick.valueScore)}`
                    : "No picks yet"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Best Remaining Team
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {bestRemainingTeam ? bestRemainingTeam.school_name : "—"}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {bestRemainingTeam
                    ? `Composite ${formatComposite(getCompositeRank(bestRemainingTeam))}`
                    : "Draft complete"}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                <div className="text-sm font-semibold text-white">
                  Biggest Reach So Far
                </div>
                {biggestReachPick ? (
                  <div className="mt-3">
                    <div className="flex items-center gap-3">
                      <TeamLogo teamName={biggestReachPick.teamName} size={30} />
                      <div>
                        <div className="font-semibold text-white">
                          Pick #{biggestReachPick.overall_pick} • {biggestReachPick.teamName}
                        </div>
                        <div className="text-sm text-slate-300">
                          {biggestReachPick.owner} • Value {formatComposite(biggestReachPick.valueScore)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-400">No picks yet.</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                <div className="text-sm font-semibold text-white">
                  Strongest Analytic Pick So Far
                </div>
                {bestDraftedPick ? (
                  <div className="mt-3">
                    <div className="flex items-center gap-3">
                      <TeamLogo teamName={bestDraftedPick.teamName} size={30} />
                      <div>
                        <div className="font-semibold text-white">
                          Pick #{bestDraftedPick.overall_pick} • {bestDraftedPick.teamName}
                        </div>
                        <div className="text-sm text-slate-300">
                          {bestDraftedPick.owner} • Composite {formatComposite(bestDraftedPick.compositeRank)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-400">No picks yet.</div>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {managerRecap.map((manager) => (
                <div key={manager.id} className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <ManagerBadge name={manager.name} />
                      <div>
                        <div className="font-semibold text-white">{manager.name}</div>
                        <div className="text-sm text-slate-400">
                          {manager.totalPicks} picks made
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                      <div className="rounded-xl bg-[#111827] p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Avg Composite
                        </div>
                        <div className="mt-1 font-semibold text-white">
                          {formatComposite(manager.avgComposite)}
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#111827] p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Avg Seed
                        </div>
                        <div className="mt-1 font-semibold text-white">
                          {manager.avgSeed === null ? "—" : manager.avgSeed.toFixed(2)}
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#111827] p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          Best Team Drafted
                        </div>
                        <div className="mt-1 font-semibold text-white">
                          {manager.bestPick ? manager.bestPick.teamName : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Recently Completed Picks">
            <div className="space-y-3">
              {recentlyCompleted.length === 0 ? (
                <div className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4 text-sm text-slate-400">
                  No picks made yet.
                </div>
              ) : (
                recentlyCompleted.map((pick) => (
                  <div key={pick.id} className="rounded-2xl border border-slate-700/80 bg-[#172033] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <TeamLogo teamName={pick.teamName} size={30} />
                        <div>
                          <div className="font-semibold text-white">
                            Pick #{pick.overall_pick} • {pick.teamName}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            {pick.seed ? `${pick.seed} Seed • ` : ""}
                            {pick.region}
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            Composite {formatComposite(pick.compositeRank)} • Value {formatComposite(pick.valueScore)}
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
          </SectionCard>
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