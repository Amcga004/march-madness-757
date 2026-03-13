"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  created_at: string;
};

type Team = {
  id: string;
  school_name: string;
};

type League = {
  id: string;
};

type StatusType = "idle" | "loading" | "success" | "error";

const ROUNDS = [
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite Eight",
  "Final Four",
  "Championship",
];

export default function AdminPanel() {
  const supabase = createClient();

  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState<League | null>(null);

  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [loserTeamId, setLoserTeamId] = useState("");
  const [roundName, setRoundName] = useState("Round of 64");

  const [status, setStatus] = useState<StatusType>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const [
        { data: gameData },
        { data: teamData },
        { data: leagueData },
      ] = await Promise.all([
        supabase
          .from("games")
          .select("id,round_name,winning_team_id,losing_team_id,created_at")
          .order("created_at", { ascending: false }),

        supabase.from("teams").select("id,school_name"),

        supabase
          .from("leagues")
          .select("id")
          .eq("public_slug", "2026-757-march-madness-draft")
          .single(),
      ]);

      if (gameData) setGames(gameData);
      if (teamData) setTeams(teamData);
      if (leagueData) setLeague(leagueData);
    }

    loadData();
  }, [supabase]);

  async function refreshResults() {
    const { data } = await supabase
      .from("games")
      .select("id,round_name,winning_team_id,losing_team_id,created_at")
      .order("created_at", { ascending: false });

    if (data) setGames(data);
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();

    if (!league) return;

    setStatus("loading");
    setMessage("Saving result...");

    const res = await fetch("/api/record-result", {
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

    const result = await res.json();

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error || "Failed to save result.");
      return;
    }

    setStatus("success");
    setMessage("Game result recorded.");

    setWinnerTeamId("");
    setLoserTeamId("");

    await refreshResults();
  }

  async function deleteResult(gameId: string) {
    if (!league) return;

    if (!window.confirm("Delete this game result?")) return;

    setStatus("loading");
    setMessage("Removing result...");

    const res = await fetch("/api/delete-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId,
        leagueId: league.id,
      }),
    });

    const result = await res.json();

    if (!result.ok) {
      setStatus("error");
      setMessage(result.error || "Delete failed.");
      return;
    }

    setStatus("success");
    setMessage("Game result removed.");

    await refreshResults();
  }

  const teamMap = new Map(teams.map((t) => [t.id, t.school_name]));

  function statusBanner() {
    if (status === "idle") return null;

    const colors =
      status === "success"
        ? "bg-green-50 border-green-200 text-green-700"
        : status === "error"
        ? "bg-red-50 border-red-200 text-red-700"
        : "bg-blue-50 border-blue-200 text-blue-700";

    return (
      <div className={`rounded-xl border px-4 py-3 text-sm ${colors}`}>
        {message}
      </div>
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Commissioner Admin Panel</h2>
          <p className="text-sm text-gray-600">
            Record results, manage draft picks, and control the tournament.
          </p>
        </div>

        <button
          onClick={signOut}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
        >
          Sign Out
        </button>
      </section>

      {statusBanner()}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Record Game Result</h3>

          <form onSubmit={submitResult} className="mt-4 space-y-4">
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
            >
              {ROUNDS.map((round) => (
                <option key={round}>{round}</option>
              ))}
            </select>

            <select
              className="w-full rounded-xl border px-3 py-2"
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
              className="w-full rounded-xl border px-3 py-2"
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

            <button
              type="submit"
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              Submit Result
            </button>
          </form>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Quick Navigation</h3>

          <div className="mt-4 grid gap-3">
            <Link
              href="/draft"
              className="rounded-xl border px-4 py-3 hover:bg-slate-50"
            >
              Draft Room
            </Link>

            <Link
              href="/rosters"
              className="rounded-xl border px-4 py-3 hover:bg-slate-50"
            >
              Team Rosters
            </Link>

            <Link
              href="/history"
              className="rounded-xl border px-4 py-3 hover:bg-slate-50"
            >
              Results History
            </Link>

            <Link
              href="/standings"
              className="rounded-xl border px-4 py-3 hover:bg-slate-50"
            >
              Standings
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Recent Results</h3>

        <div className="mt-4 space-y-3">
          {games.slice(0, 10).map((game) => (
            <div
              key={game.id}
              className="flex items-center justify-between rounded-xl border px-4 py-3"
            >
              <div>
                <div className="text-sm text-gray-500">{game.round_name}</div>

                <div className="font-semibold">
                  {teamMap.get(game.winning_team_id ?? "")} defeated{" "}
                  {teamMap.get(game.losing_team_id ?? "")}
                </div>
              </div>

              <button
                onClick={() => deleteResult(game.id)}
                className="rounded-lg border border-red-300 px-3 py-1 text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}