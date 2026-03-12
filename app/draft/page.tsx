"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSnakeDraftOrder } from "@/lib/draft";

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

export default function DraftPage() {
  const supabase = createClient();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const [{ data: leagueData }, { data: memberData }, { data: teamData }, { data: pickData }] =
        await Promise.all([
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
            .select("id,school_name,seed,region")
            .order("region", { ascending: true })
            .order("seed", { ascending: true }),
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

  const draftedTeamIds = new Set(picks.map((pick) => pick.team_id));
  const availableTeams = teams.filter((team) => !draftedTeamIds.has(team.id));

  const memberMap = new Map(members.map((m) => [m.id, m.display_name]));
  const teamMap = new Map(teams.map((t) => [t.id, t]));

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

  async function handleDraftPick(e: React.FormEvent) {
    e.preventDefault();

    if (!league || !currentMember || !currentPick || !selectedTeamId) {
      setMessage("Missing required draft information.");
      return;
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
        teamId: selectedTeamId,
        overallPick: currentPick.overallPick,
        snakeRound: currentPick.round,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      setMessage(result.error || "Failed to save pick.");
      return;
    }

    const { data: pickData } = await supabase
      .from("picks")
      .select("id,overall_pick,snake_round,member_id,team_id")
      .order("overall_pick", { ascending: true });

    if (pickData) setPicks(pickData);

    setSelectedTeamId("");
    setMessage("Pick saved.");
  }

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Draft Room</h1>
        <p className="mt-2 text-gray-600">
          Commissioner-controlled live snake draft.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Completed Picks</div>
          <div className="mt-1 text-2xl font-bold">{picks.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Taken Teams</div>
          <div className="mt-1 text-2xl font-bold">{draftedTeamIds.size}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Remaining Teams</div>
          <div className="mt-1 text-2xl font-bold">{availableTeams.length}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Current Pick</h2>

          {currentPick && currentMember ? (
            <div className="mt-4 space-y-2">
              <div className="text-lg font-medium">Pick #{currentPick.overallPick}</div>
              <div className="text-gray-600">Round {currentPick.round}</div>
              <div className="text-gray-800">
                On the clock: <span className="font-semibold">{currentMember.display_name}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-gray-600">Draft complete or not enough members loaded.</div>
          )}

          <form onSubmit={handleDraftPick} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Select Team</label>
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                required
              >
                <option value="">Choose a team</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.school_name} • {team.seed} Seed • {team.region}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="rounded-xl bg-black px-4 py-2 text-white">
              Draft Team
            </button>

            {message ? <p className="text-sm text-gray-600">{message}</p> : null}
          </form>

          <div className="mt-8">
            <h3 className="text-lg font-semibold">Next 10 Picks</h3>
            <div className="mt-3 space-y-3">
              {snake
                .filter((pick) => pick.overallPick >= nextOverallPick)
                .slice(0, 10)
                .map((pick) => (
                  <div key={pick.overallPick} className="rounded-xl border p-3">
                    <div className="font-medium">Pick #{pick.overallPick}</div>
                    <div className="text-sm text-gray-600">Round {pick.round}</div>
                    <div className="mt-1">{pick.player}</div>
                  </div>
                ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Completed Picks</h2>

          {completedPicks.length === 0 ? (
            <div className="mt-4 rounded-xl border p-4 text-sm text-gray-600">
              No picks made yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {completedPicks.map((pick) => (
                <div key={pick.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">
                        Pick #{pick.overall_pick} • {pick.owner}
                      </div>
                      <div className="mt-1 text-gray-700">{pick.teamName}</div>
                      <div className="mt-1 text-sm text-gray-600">
                        {pick.seed ? `${pick.seed} Seed • ` : ""}
                        {pick.region}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">Round {pick.snake_round}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}