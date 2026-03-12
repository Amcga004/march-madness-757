"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type League = {
  id: string;
  name: string;
};

const ROUNDS = [
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite Eight",
  "Final Four",
  "Championship",
];

export default function ResultsPage() {
  const supabase = createClient();

  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [loserTeamId, setLoserTeamId] = useState("");
  const [roundName, setRoundName] = useState("Round of 64");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const [{ data: leagueData }, { data: teamData }] = await Promise.all([
        supabase
          .from("leagues")
          .select("id,name")
          .eq("public_slug", "2026-757-march-madness-draft")
          .single(),
        supabase
          .from("teams")
          .select("id,school_name,seed,region")
          .order("region", { ascending: true })
          .order("seed", { ascending: true }),
      ]);

      if (leagueData) setLeague(leagueData);
      if (teamData) setTeams(teamData);
    }

    loadData();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Saving result...");

    if (!league) {
      setMessage("League not found.");
      return;
    }

    const response = await fetch("/api/record-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leagueId: league.id,
        winnerTeamId,
        loserTeamId,
        roundName,
      }),
    });

    const result = await response.json();

    if (result.ok) {
      setMessage("Result saved successfully.");
      setWinnerTeamId("");
      setLoserTeamId("");
    } else {
      setMessage(result.error || "Something went wrong.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Record Game Result</h1>
        <p className="mt-2 text-gray-600">
          Enter game winners and losers to update scoring.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">Round</label>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
          >
            {ROUNDS.map((round) => (
              <option key={round} value={round}>
                {round}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Winning Team</label>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={winnerTeamId}
            onChange={(e) => setWinnerTeamId(e.target.value)}
            required
          >
            <option value="">Select winner</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.school_name} • {team.seed} Seed • {team.region}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Losing Team</label>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={loserTeamId}
            onChange={(e) => setLoserTeamId(e.target.value)}
            required
          >
            <option value="">Select loser</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.school_name} • {team.seed} Seed • {team.region}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="rounded-xl bg-black px-4 py-2 text-white">
          Save Result
        </button>

        {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      </form>
    </main>
  );
}