"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Pick = {
  id: string;
};

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  created_at: string;
};

type Member = {
  id: string;
  display_name: string;
};

type TeamResult = {
  id: string;
  eliminated: boolean;
  total_points: number;
};

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

export default function AdminPage() {
  const supabase = createClient();

  const [picks, setPicks] = useState<Pick[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [teamResults, setTeamResults] = useState<TeamResult[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<League | null>(null);

  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [loserTeamId, setLoserTeamId] = useState("");
  const [roundName, setRoundName] = useState("Round of 64");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const [
        { data: picksData },
        { data: gamesData },
        { data: membersData },
        { data: resultsData },
        { data: teamsData },
        { data: leagueData },
      ] = await Promise.all([
        supabase.from("picks").select("id"),
        supabase
          .from("games")
          .select("id, round_name, winning_team_id, losing_team_id, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("league_members").select("id, display_name"),
        supabase.from("team_results").select("id, eliminated, total_points"),
        supabase
          .from("teams")
          .select("id, school_name, seed, region")
          .order("region", { ascending: true })
          .order("seed", { ascending: true }),
        supabase
          .from("leagues")
          .select("id, name")
          .eq("public_slug", "2026-757-march-madness-draft")
          .single(),
      ]);

      if (picksData) setPicks(picksData);
      if (gamesData) setGames(gamesData);
      if (membersData) setMembers(membersData);
      if (resultsData) setTeamResults(resultsData);
      if (teamsData) setTeams(teamsData);
      if (leagueData) setLeague(leagueData);
    }

    loadData();
  }, [supabase]);

  async function refreshLeagueData() {
    const [{ data: gamesData }, { data: resultsData }] = await Promise.all([
      supabase
        .from("games")
        .select("id, round_name, winning_team_id, losing_team_id, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("team_results").select("id, eliminated, total_points"),
    ]);

    if (gamesData) setGames(gamesData);
    if (resultsData) setTeamResults(resultsData);
  }

  async function handleSubmitResult(e: React.FormEvent) {
    e.preventDefault();

    if (!league) {
      setMessage("League not found.");
      return;
    }

    setMessage("Saving result...");

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
      await refreshLeagueData();
    } else {
      setMessage(result.error || "Something went wrong.");
    }
  }

  async function handleDeleteResult(gameId: string) {
    if (!league) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this result?"
    );

    if (!confirmed) return;

    setMessage("Deleting result...");

    const response = await fetch("/api/delete-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId,
        leagueId: league.id,
      }),
    });

    const result = await response.json();

    if (result.ok) {
      setMessage("Result deleted.");
      await refreshLeagueData();
    } else {
      setMessage(result.error || "Failed to delete result.");
    }
  }

  const totalPicks = picks.length;
  const totalResults = games.length;
  const teamsAlive = teamResults.filter((t) => !t.eliminated).length;
  const teamsWithPoints = teamResults.filter((t) => t.total_points > 0).length;

  const teamMap = new Map(teams.map((t) => [t.id, t.school_name]));
  const recentResults = games.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h2 className="mb-6 text-3xl font-bold">Commissioner Admin Panel</h2>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat title="Total Picks Made" value={totalPicks} />
        <Stat title="Results Recorded" value={totalResults} />
        <Stat title="Teams Alive" value={teamsAlive} />
        <Stat title="Teams With Points" value={teamsWithPoints} />
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border p-6">
          <h3 className="text-xl font-semibold">Record Game Result</h3>

          <form onSubmit={handleSubmitResult} className="mt-4 space-y-4">
            <select
              className="w-full rounded border p-2"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
            >
              {ROUNDS.map((round) => (
                <option key={round}>{round}</option>
              ))}
            </select>

            <select
              className="w-full rounded border p-2"
              value={winnerTeamId}
              onChange={(e) => setWinnerTeamId(e.target.value)}
            >
              <option value="">Winning Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.school_name}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded border p-2"
              value={loserTeamId}
              onChange={(e) => setLoserTeamId(e.target.value)}
            >
              <option value="">Losing Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.school_name}
                </option>
              ))}
            </select>

            <button className="rounded bg-black px-4 py-2 text-white">
              Submit Result
            </button>
          </form>

          {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
        </div>

        <div className="rounded-2xl border p-6">
          <h3 className="text-xl font-semibold">Commissioner Actions</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link href="/make-pick" className="rounded border p-4">
              Make Draft Pick
            </Link>

            <Link href="/draft" className="rounded border p-4">
              Open Draft Room
            </Link>

            <Link href="/history" className="rounded border p-4">
              Review Results History
            </Link>

            <Link href="/standings" className="rounded border p-4">
              Standings Detail
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-6">
        <h3 className="text-xl font-semibold">Recent Entered Results</h3>

        <div className="mt-4 space-y-3">
          {recentResults.map((game) => (
            <div key={game.id} className="flex justify-between border p-4">
              <div>
                <div className="text-sm text-gray-500">{game.round_name}</div>
                <div className="font-semibold">
                  {teamMap.get(game.winning_team_id ?? "")} defeated{" "}
                  {teamMap.get(game.losing_team_id ?? "")}
                </div>
              </div>

              <button
                onClick={() => handleDeleteResult(game.id)}
                className="rounded border border-red-400 px-3 py-1 text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}