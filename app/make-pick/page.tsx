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
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Draft Room</h1>
        <p className="mt-2 text-gray-600">
          Commissioner-controlled live snake draft.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
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
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Next 12 Picks</h2>

          <div className="mt-4 space-y-3">
            {snake
              .filter((pick) => pick.overallPick >= nextOverallPick)
              .slice(0, 12)
              .map((pick) => (
                <div key={pick.overallPick} className="rounded-xl border p-3">
                  <div className="font-medium">Pick #{pick.overallPick}</div>
                  <div className="text-sm text-gray-600">Round {pick.round}</div>
                  <div className="mt-1">{pick.player}</div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}