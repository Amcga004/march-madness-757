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

type MemberRole = "admin" | "manager" | "commissioner" | null;

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
  email: string | null;
  auth_user_id: string | null;
  role: MemberRole;
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
  email: string | null;
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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [message, setMessage] = useState("");
  const [teamSearch, setTeamSearch] = useState("");

  const [pendingPickTeamId, setPendingPickTeamId] = useState<string | null>(null);
  const [pendingPickTeamName, setPendingPickTeamName] = useState("");
  const [isSubmittingPick, setIsSubmittingPick] = useState(false);

  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    async function loadAll() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setAuthUser(
        user
          ? {
              id: user.id,
              email: user.email ?? null,
            }
          : null
      );

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
          .select("id,display_name,draft_slot,email,auth_user_id,role")
          .order("draft_slot", { ascending: true }),
        supabase
          .from("teams")
          .select(
            "id,school_name,seed,region,kenpom_rank,bpi_rank,net_rank,record,conference_record,off_efficiency,def_efficiency"
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
      if (memberData) setMembers(memberData as Member[]);
      if (teamData) setTeams(teamData as Team[]);
      if (pickData) setPicks(pickData as Pick[]);
    }

    loadAll();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;

      setAuthUser(
        user
          ? {
              id: user.id,
              email: user.email ?? null,
            }
          : null
      );
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const orderedMembers = useMemo(() => {
    return [...members].sort((a, b) => a.draft_slot - b.draft_slot);
  }, [members]);

  const signedInMember = useMemo(() => {
    if (!authUser) return null;

    return (
      members.find((member) => member.auth_user_id === authUser.id) ??
      members.find(
        (member) =>
          member.email &&
          authUser.email &&
          member.email.toLowerCase() === authUser.email.toLowerCase()
      ) ??
      null
    );
  }, [members, authUser]);

  const isAdmin = signedInMember?.role === "admin" || signedInMember?.role === "commissioner";

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

  const currentManagerName = currentMember?.display_name ?? "Current Manager";
  const totalPicks = snake.length || teams.length || 64;
  const currentRoundLabel = currentPick ? `Round ${currentPick.round}` : undefined;

  const normalizedTeams = useMemo(() => {
    return teams.map((team) => ({
      ...team,
      school_name: getCanonicalTeamName(team.school_name),
    }));
  }, [teams]);

  const draftedTeamIds = useMemo(() => {
    return new Set(picks.map((pick) => pick.team_id));
  }, [picks]);

  const availableTeams = useMemo(() => {
    return normalizedTeams.filter((team) => !draftedTeamIds.has(team.id));
  }, [normalizedTeams, draftedTeamIds]);

  const filteredAvailableTeams = useMemo(() => {
    return availableTeams.filter((team) => {
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
  }, [availableTeams, teamSearch]);

  const memberMap = useMemo(() => {
    return new Map(members.map((m) => [m.id, m.display_name]));
  }, [members]);

  const teamMap = useMemo(() => {
    return new Map(normalizedTeams.map((t) => [t.id, t]));
  }, [normalizedTeams]);

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

  const canMakeCurrentPick = useMemo(() => {
    if (!authUser || !signedInMember || !currentMember || !currentPick) return false;
    if (isAdmin) return true;
    return signedInMember.id === currentMember.id;
  }, [authUser, signedInMember, currentMember, currentPick, isAdmin]);

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

  async function refreshPicks() {
    const { data: pickData } = await supabase
      .from("picks")
      .select("id,overall_pick,snake_round,member_id,team_id")
      .order("overall_pick", { ascending: true });

    if (pickData) setPicks(pickData as Pick[]);
  }

  async function sendMagicLink() {
    if (!authEmail.trim()) {
      setAuthMessage("Enter your email address.");
      return;
    }

    setIsSendingMagicLink(true);
    setAuthMessage("");

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setAuthMessage(error.message || "Failed to send magic link.");
        return;
      }

      setAuthMessage("Magic link sent. Check your email.");
    } finally {
      setIsSendingMagicLink(false);
    }
  }

  async function signOut() {
    setIsSigningOut(true);

    try {
      await supabase.auth.signOut();
      setAuthUser(null);
      setAuthMessage("Signed out.");
    } finally {
      setIsSigningOut(false);
    }
  }

  async function submitDraftPick(teamId: string) {
    if (!league || !currentMember || !currentPick || !teamId) {
      setMessage("Missing required draft information.");
      return false;
    }

    if (!canMakeCurrentPick) {
      setMessage("You do not have permission to make this pick.");
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

    if (!canMakeCurrentPick) {
      setMessage("You are not authorized to make this pick.");
      return;
    }

    if (!selectedTeamId) {
      setMessage("Please select a team.");
      return;
    }

    const pickedTeam = normalizedTeams.find((team) => team.id === selectedTeamId);

    setPendingPickTeamId(selectedTeamId);
    setPendingPickTeamName(pickedTeam?.school_name ?? "Selected Team");
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
    if (!isAdmin) {
      setMessage("Only the commissioner/admin can undo picks.");
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
      <section className="mb-6 sm:mb-8">
        <h2 className="text-3xl font-bold">Draft Room</h2>
        <p className="mt-2 text-gray-600">
          Live draft room with manager sign-in and role-based pick controls.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm sm:mb-8 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Draft Access
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {authUser ? "Signed In" : "Manager Sign In"}
            </div>

            {authUser ? (
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div>
                  Email: <span className="font-semibold">{authUser.email ?? "—"}</span>
                </div>
                <div>
                  Access:{" "}
                  <span className="font-semibold">
                    {signedInMember
                      ? `${signedInMember.display_name} • ${signedInMember.role ?? "manager"}`
                      : "Signed in, but not mapped to a league member"}
                  </span>
                </div>
                {currentPick && currentMember ? (
                  <div>
                    Current picker: <span className="font-semibold">{currentMember.display_name}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">
                Sign in with your league email to make picks when you are on the clock.
              </div>
            )}
          </div>

          {authUser ? (
            <button
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
              className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSigningOut ? "Signing Out..." : "Sign Out"}
            </button>
          ) : null}
        </div>

        {!authUser ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Enter your league email"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={isSendingMagicLink}
              className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSendingMagicLink ? "Sending..." : "Send Magic Link"}
            </button>
          </div>
        ) : null}

        {authMessage ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            {authMessage}
          </div>
        ) : null}

        {authUser && !signedInMember ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Your signed-in email is not mapped to a league member yet, so you can view the board but cannot make picks.
          </div>
        ) : null}

        {authUser && signedInMember && !canMakeCurrentPick && currentPick && currentMember ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            You are signed in as {signedInMember.display_name}, but it is currently {currentMember.display_name}'s turn to pick.
          </div>
        ) : null}

        {authUser && canMakeCurrentPick && currentPick && currentMember ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            You are authorized to make the current pick.
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

                {!authUser ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    Sign in with your league email to make picks.
                  </div>
                ) : !signedInMember ? (
                  <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                    Your account is not linked to a league member, so draft actions are disabled.
                  </div>
                ) : (
                  <form onSubmit={handleDraftPick} className="mt-6 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Search Teams</label>
                      <input
                        type="text"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Search by school, alias, region, seed, or ranking"
                        className="w-full rounded-xl border px-3 py-2"
                        disabled={!canMakeCurrentPick}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Select Team</label>
                      <select
                        className="w-full rounded-xl border px-3 py-2"
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
                              Composite: <span className="font-semibold">{formatComposite(getCompositeRank(selectedTeam))}</span>
                            </div>
                            <div className="mt-1 text-sm text-slate-700">
                              Value Score: <span className="font-semibold">{formatComposite(getValueScore(selectedTeam))}</span>
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

                    {!canMakeCurrentPick ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                        Draft controls are locked until it is your turn. Commissioner/admin can override from this screen when signed in.
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="submit"
                        disabled={!canMakeCurrentPick}
                        className="w-full rounded-xl bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        Draft Team
                      </button>

                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={undoLastPick}
                          className="w-full rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50 sm:w-auto"
                        >
                          Undo Last Pick
                        </button>
                      ) : null}
                    </div>

                    {message ? <p className="text-sm text-gray-600">{message}</p> : null}
                  </form>
                )}
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
                    ? `Composite ${formatComposite(getCompositeRank(bestRemainingTeam))}`
                    : "Draft complete"}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Biggest Reach So Far
                </div>
                {biggestReachPick ? (
                  <div className="mt-3">
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
                  <div className="mt-3">
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

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
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
                          Best Team Drafted
                        </div>
                        <div className="mt-1 font-semibold text-slate-900">
                          {manager.bestPick ? manager.bestPick.teamName : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Draft recap email delivery is not wired up in this file yet. Once the draft is complete, that should be handled from a server-side route or automation so each manager gets an individualized summary.
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

          {signedInMember ? (
            <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-xl font-semibold">Your Access</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Signed In As
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {signedInMember.display_name}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Role: {signedInMember.role ?? "manager"}
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Draft Permission
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {canMakeCurrentPick
                      ? "You can make the current pick."
                      : "You can view the room, but cannot make the current pick right now."}
                  </div>
                </div>

                {isAdmin ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    Commissioner/admin controls such as draft lottery should now live in the admin panel, not this draft room.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
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