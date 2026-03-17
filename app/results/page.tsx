"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TeamLogo from "../components/TeamLogo";

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type Game = {
  id: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  status: string | null;
  created_at: string;
};

const ROUNDS = [
  "All Rounds",
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite Eight",
  "Final Four",
  "Championship",
] as const;

const ROUND_TARGETS: Record<string, number> = {
  "Round of 64": 32,
  "Round of 32": 16,
  "Sweet 16": 8,
  "Elite Eight": 4,
  "Final Four": 2,
  Championship: 1,
};

function RoundProgressCard({
  round,
  completed,
  total,
}: {
  round: string;
  completed: number;
  total: number;
}) {
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{round}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-2xl font-extrabold tracking-tight text-slate-950">
          {completed}/{total}
        </div>
        <div className="text-sm font-medium text-slate-600">{percent}%</div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("All Rounds");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const [{ data: teamData, error: teamError }, { data: gameData, error: gameError }] =
        await Promise.all([
          supabase
            .from("teams")
            .select("id,school_name,seed,region")
            .order("region", { ascending: true })
            .order("seed", { ascending: true }),
          supabase
            .from("games")
            .select("id,round_name,winning_team_id,losing_team_id,status,created_at")
            .order("created_at", { ascending: false }),
        ]);

      if (teamError || gameError) {
        setMessage(teamError?.message || gameError?.message || "Failed to load results.");
        return;
      }

      setTeams((teamData as Team[]) ?? []);
      setGames((gameData as Game[]) ?? []);
    }

    loadData();
  }, [supabase]);

  const teamMap = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);

  const filteredGames = useMemo(() => {
    if (selectedRound === "All Rounds") return games;
    return games.filter((game) => game.round_name === selectedRound);
  }, [games, selectedRound]);

  const latestUpdated = games[0]?.created_at ?? null;

  const roundProgress = useMemo(() => {
    return Object.entries(ROUND_TARGETS).map(([round, total]) => {
      const completed = games.filter((game) => game.round_name === round).length;
      return {
        round,
        completed,
        total,
      };
    });
  }, [games]);

  const totalGamesRecorded = games.length;
  const latestRoundUpdated = games[0]?.round_name ?? "None";

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <section className="mb-5 sm:mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Results
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Live Tournament Results
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Track completed games, round progress, and the latest tournament updates.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            {latestUpdated
              ? `Last updated: ${new Date(latestUpdated).toLocaleString()}`
              : "No results entered yet"}
          </div>
        </div>
      </section>

      {message ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="text-sm font-medium text-slate-500">Results Recorded</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
            {totalGamesRecorded}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="text-sm font-medium text-slate-500">Latest Round Updated</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
            {latestRoundUpdated}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="text-sm font-medium text-slate-500">Rounds Active</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
            {roundProgress.filter((round) => round.completed > 0).length}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-8 sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-950">Round Progress</h2>
          <p className="mt-1 text-sm text-slate-600">
            Progress tracker for each tournament round based on recorded results.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roundProgress.map((round) => (
            <RoundProgressCard
              key={round.round}
              round={round.round}
              completed={round.completed}
              total={round.total}
            />
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Completed Games</h2>
            <p className="mt-1 text-sm text-slate-600">
              Filter results by round or view the full live feed.
            </p>
          </div>

          <div className="w-full sm:w-[240px]">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Filter by Round
            </label>
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
            >
              {ROUNDS.map((round) => (
                <option key={round} value={round}>
                  {round}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {filteredGames.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">
            No game results recorded for this view yet.
          </div>
        ) : (
          filteredGames.map((game) => {
            const winnerTeam = teamMap.get(game.winning_team_id ?? "");
            const loserTeam = teamMap.get(game.losing_team_id ?? "");

            const winnerName = winnerTeam?.school_name ?? "Unknown winner";
            const loserName = loserTeam?.school_name ?? "Unknown loser";

            return (
              <div
                key={game.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-slate-500">{game.round_name}</div>
                  <div className="text-sm text-slate-500">
                    {new Date(game.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 text-base font-semibold sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="flex items-center gap-2">
                    <TeamLogo teamName={winnerName} size={26} />
                    <span>
                      {winnerTeam?.seed ? `${winnerTeam.seed}. ` : ""}
                      {winnerName}
                    </span>
                  </div>

                  <span className="text-slate-400">defeated</span>

                  <div className="flex items-center gap-2">
                    <TeamLogo teamName={loserName} size={26} />
                    <span>
                      {loserTeam?.seed ? `${loserTeam.seed}. ` : ""}
                      {loserName}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-600">
                  Status: {game.status ?? "complete"}
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}