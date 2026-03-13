""use client";

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
      await refreshLeagueData();
    } else {
      setMessage(result.error || "Something went wrong.");
    }
  }

  async function handleDeleteResult(gameId: string) {
    if (!league) {
      setMessage("League not found.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this result and recalculate scoring?"
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
      setMessage("Result deleted and standings recalculated.");
      await refreshLeagueData();
    } else {
      setMessage(result.error || "Failed to delete result.");
    }
  }

  const totalPicks = picks.length;
  const totalResults = games.length;
  const teamsAlive = teamResults.filter((team) => team.eliminated === false).length;
  const teamsWithPoints = teamResults.filter((team) => team.total_points > 0).length;

  const teamMap = new Map(teams.map((team) => [team.id, team.school_name]));
  const recentResults = games.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <section className="mb-8">
        <h2 className="text-3xl font-bold">Commissioner Admin Panel</h2>
        <p className="mt-2 text-gray-600">
          Manage draft picks, submit results, and monitor league status.
        </p>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Total Picks Made</div>
          <div className="mt-1 text-3xl font-bold">{totalPicks}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Results Recorded</div>
          <div className="mt-1 text-3xl font-bold">{totalResults}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Teams Alive</div>
          <div className="mt-1 text-3xl font-bold">{teamsAlive}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Teams With Points</div>
          <div className="mt-1 text-3xl font-bold">{teamsWithPoints}</div>
        </div>
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Record Game Result</h3>
          <p className="mt-2 text-sm text-gray-600">
            Submit winners and losers here to update scoring and standings.
          </p>

          <form onSubmit={handleSubmitResult} className="mt-6 space-y-4">
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

            <button
              type="submit"
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              Submit Result
            </button>

            {message ? <p className="text-sm text-gray-600">{message}</p> : null}
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Commissioner Actions</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href="/make-pick"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Make Draft Pick</div>
              <div className="mt-2 text-sm text-gray-600">
                Manually assign a team to a manager.
              </div>
            </Link>

            <Link
              href="/draft"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Open Draft Room</div>
              <div className="mt-2 text-sm text-gray-600">
                View current pick and continue the live draft.
              </div>
            </Link>

            <Link
              href="/history"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Review Results History</div>
              <div className="mt-2 text-sm text-gray-600">
                Confirm which game results have already been entered.
              </div>
            </Link>

            <Link
              href="/standings"
              className="rounded-2xl border p-5 transition hover:bg-slate-50"
            >
              <div className="text-lg font-semibold">Standings Detail</div>
              <div className="mt-2 text-sm text-gray-600">
                Review expanded standings and roster outcomes.
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Recent Entered Results</h3>

        <div className="mt-4 space-y-3">
          {recentResults.length === 0 ? (
            <div className="rounded-xl border p-4 text-sm text-gray-600">
              No game results recorded yet.
            </div>
          ) : (
            recentResults.map((game) => (
              <div key={game.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-gray-500">{game.round_name}</div>
                    <div className="mt-1 font-semibold">
                      {teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner"} defeated{" "}
                      {teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser"}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {new Date(game.created_at).toLocaleString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteResult(game.id)}
                    className="rounded-xl border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">League Members</h3>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {members.map((member) => (
            <div key={member.id} className="rounded-xl border p-4">
              <div className="font-semibold">{member.display_name}</div>
              <div className="mt-1 text-sm text-gray-600">
                Commissioner tools can be used to manage picks and results.
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}