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

  useEffect(() => {
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
      if (memberData) setMembers(memberData);
      if (teamData) setTeams(teamData);
      if (pickData) setPicks(pickData);
    }

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

  const completedPicks = picks.map((pick) => {
    const team = teamMap.get(pick.team_id);
    return {
      ...pick,
      owner: memberMap.get(pick.member_id) ?? "Unknown",
      teamName: team?.school_name ?? "Unknown Team",
      seed: team?.seed ?? null,
      region: team?.region ?? "",
    };
  });

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

  async function refreshPicks() {
    const { data: pickData } = await supabase
      .from("picks")
      .select("id,overall_pick,snake_round,member_id,team_id")
      .order("overall_pick", { ascending: true });

    if (pickData) setPicks(pickData);
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

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
        </div>

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