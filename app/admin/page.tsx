"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ManagerBadge from "../components/ManagerBadge";
import TeamLogo from "../components/TeamLogo";

type Member = {
  id: string;
  display_name: string;
  draft_slot: number;
  email: string | null;
  role: string | null;
  user_id: string | null;
};

type LotteryRevealSlot = 1 | 2 | 3 | 4;

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
  seed: number;
  region: string;
};

type League = {
  id: string;
  name?: string;
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [authUser, setAuthUser] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [picksCount, setPicksCount] = useState(0);
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [email, setEmail] = useState("amacbfs@gmail.com");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [loserTeamId, setLoserTeamId] = useState("");
  const [roundName, setRoundName] = useState("Round of 64");
  const [seasonYear, setSeasonYear] = useState<number>(2026);

  const [isRunningLottery, setIsRunningLottery] = useState(false);
  const [lotteryResults, setLotteryResults] = useState<
    Partial<Record<LotteryRevealSlot, Member>>
  >({});
  const [status, setStatus] = useState<StatusType>("idle");
  const [message, setMessage] = useState("");

  const [isRunningSyncCycle, setIsRunningSyncCycle] = useState(false);
  const [syncDate, setSyncDate] = useState("20260319");

  async function loadData() {
    const [
      { data: auth },
      { data: memberData },
      { count },
      { data: leagueData },
      { data: teamData },
      { data: gameData },
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("league_members")
        .select("id,display_name,draft_slot,email,role,user_id")
        .order("draft_slot", { ascending: true }),
      supabase.from("picks").select("*", { count: "exact", head: true }),
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
      supabase
        .from("games")
        .select("id,round_name,winning_team_id,losing_team_id,created_at")
        .order("created_at", { ascending: false }),
    ]);

    setAuthUser(auth.user ?? null);
    setMembers((memberData as Member[]) ?? []);
    setPicksCount(count ?? 0);
    setLeague((leagueData as League) ?? null);
    setTeams((teamData as Team[]) ?? []);
    setGames((gameData as Game[]) ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const signedInMember = useMemo(() => {
    if (!authUser) return null;
    return members.find((m) => m.user_id === authUser.id) ?? null;
  }, [authUser, members]);

  const isCommissioner = signedInMember?.role === "commissioner";
  const lotteryDisplayOrder: LotteryRevealSlot[] = [4, 3, 2, 1];
  const lotteryLocked = picksCount > 0;
  const latestUpdated = games[0]?.created_at ?? null;
  const teamMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t.school_name])),
    [teams]
  );

  function setStatusMessage(nextStatus: StatusType, nextMessage: string) {
    setStatus(nextStatus);
    setMessage(nextMessage);
  }

  function renderStatusBanner() {
    if (status === "idle" || !message) return null;

    const classes =
      status === "success"
        ? "border-green-200 bg-green-50 text-green-700"
        : status === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

    return (
      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${classes}`}>
        {message}
      </div>
    );
  }

  async function signInWithPassword() {
    if (!email.trim() || !password.trim()) {
      setStatusMessage("error", "Please enter both email and password.");
      return;
    }

    setIsSigningIn(true);
    setStatusMessage("loading", "Signing in...");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setIsSigningIn(false);
      setStatusMessage("error", error.message || "Failed to sign in.");
      return;
    }

    await loadData();
    setIsSigningIn(false);
    setStatusMessage("success", "Signed in successfully.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  async function refreshResults() {
    const { data } = await supabase
      .from("games")
      .select("id,round_name,winning_team_id,losing_team_id,created_at")
      .order("created_at", { ascending: false });

    if (data) setGames(data as Game[]);
  }

  async function runDraftLottery() {
    if (!isCommissioner) {
      setStatusMessage("error", "Only the commissioner can run the draft lottery.");
      return;
    }

    if (members.length !== 4) {
      setStatusMessage("error", "Lottery requires exactly 4 managers.");
      return;
    }

    if (lotteryLocked) {
      setStatusMessage("error", "Draft order cannot change after picks have started.");
      return;
    }

    const confirmed = window.confirm(
      "Run the draft lottery and overwrite the current draft order?"
    );
    if (!confirmed) return;

    setIsRunningLottery(true);
    setLotteryResults({});
    setStatusMessage("loading", "Running lottery...");

    try {
      const shuffled = [...members]
        .map((m) => ({ m, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.m);

      const revealMap: Partial<Record<LotteryRevealSlot, Member>> = {};

      for (let i = 0; i < shuffled.length; i++) {
        const slot = lotteryDisplayOrder[i];
        revealMap[slot] = shuffled[i];
        setLotteryResults({ ...revealMap });

        if (i < shuffled.length - 1) {
          await wait(2000);
        }
      }

      const finalOrder = [...shuffled].reverse();

      for (let i = 0; i < finalOrder.length; i++) {
        const { error } = await supabase
          .from("league_members")
          .update({ draft_slot: i + 1 })
          .eq("id", finalOrder[i].id);

        if (error) {
          throw new Error(error.message || "Failed to update draft slots.");
        }
      }

      await loadData();
      setStatusMessage("success", "Draft lottery complete.");
    } catch (error: any) {
      setStatusMessage("error", error?.message || "Draft lottery failed.");
    } finally {
      setIsRunningLottery(false);
    }
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();

    if (!isCommissioner) {
      setStatusMessage("error", "Only the commissioner can record results.");
      return;
    }

    if (!league) {
      setStatusMessage("error", "League not found.");
      return;
    }

    if (!winnerTeamId || !loserTeamId) {
      setStatusMessage("error", "Please select both a winning team and losing team.");
      return;
    }

    if (winnerTeamId === loserTeamId) {
      setStatusMessage("error", "Winning team and losing team cannot be the same.");
      return;
    }

    setStatusMessage("loading", "Saving result...");

    try {
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
        setStatusMessage("error", result.error || "Failed to save result.");
        return;
      }

      setWinnerTeamId("");
      setLoserTeamId("");
      await refreshResults();
      setStatusMessage("success", "Game result recorded.");
    } catch {
      setStatusMessage("error", "Failed to save result.");
    }
  }

  async function deleteResult(gameId: string) {
    if (!isCommissioner) {
      setStatusMessage("error", "Only the commissioner can delete results.");
      return;
    }

    if (!league) {
      setStatusMessage("error", "League not found.");
      return;
    }

    if (!window.confirm("Delete this game result?")) return;

    setStatusMessage("loading", "Removing result...");

    try {
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
        setStatusMessage("error", result.error || "Delete failed.");
        return;
      }

      await refreshResults();
      setStatusMessage("success", "Game result removed.");
    } catch {
      setStatusMessage("error", "Delete failed.");
    }
  }

  async function archiveSeason() {
    if (!isCommissioner) {
      setStatusMessage("error", "Only the commissioner can archive a season.");
      return;
    }

    const confirmed = window.confirm(
      `Archive final standings for the ${seasonYear} season? Do this only after all results are entered and standings are final.`
    );
    if (!confirmed) return;

    setStatusMessage("loading", "Archiving current season standings...");

    try {
      const res = await fetch("/api/admin/archive-season", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seasonYear,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        setStatusMessage("error", result.error || "Season archive failed.");
        return;
      }

      setStatusMessage(
        "success",
        `Season ${result.archivedSeason} archived successfully. ${result.rowsInserted} standings rows saved.`
      );
    } catch {
      setStatusMessage("error", "Season archive failed.");
    }
  }

  async function resetLeague() {
    if (!isCommissioner) {
      setStatusMessage("error", "Only the commissioner can reset the league.");
      return;
    }

    const confirmed = window.confirm(
      "Reset the league? This will delete all picks, recorded game results, and team results, but keep league members and teams."
    );
    if (!confirmed) return;

    setStatusMessage("loading", "Resetting league data...");

    try {
      const res = await fetch("/api/reset-league", {
        method: "POST",
      });

      const result = await res.json();

      if (!result.ok) {
        setStatusMessage("error", result.error || "Reset failed.");
        return;
      }

      await loadData();
      setWinnerTeamId("");
      setLoserTeamId("");
      setRoundName("Round of 64");
      setLotteryResults({});
      setStatusMessage("success", "League reset complete.");
    } catch {
      setStatusMessage("error", "Reset failed.");
    }
  }

  async function runSyncCycle() {
    if (!isCommissioner) {
      setStatusMessage("error", "Only the commissioner can run the sync cycle.");
      return;
    }

    if (!syncDate.trim()) {
      setStatusMessage("error", "Please enter a sync date in YYYYMMDD format.");
      return;
    }

    setIsRunningSyncCycle(true);
    setStatusMessage("loading", `Running ESPN sync cycle for ${syncDate}...`);

    try {
      const res = await fetch("/api/admin/run-sync-cycle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "757mm2026"}`,
        },
        body: JSON.stringify({
          date: syncDate.trim(),
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        setStatusMessage("error", result.error || "Sync cycle failed.");
        return;
      }

      await refreshResults();

      setStatusMessage(
        "success",
        `Sync complete for ${result.date}. Events seen: ${result.eventsSeen}. Rows upserted: ${result.rowsUpserted}. Mapped rows: ${result.mappedRows}. Promoted games: ${result.promotedGames}.`
      );
    } catch {
      setStatusMessage("error", "Sync cycle failed.");
    } finally {
      setIsRunningSyncCycle(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Admin Panel
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Commissioner controls for lottery, live sync, results, season archive, and league maintenance.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {latestUpdated
              ? `Last result update: ${new Date(latestUpdated).toLocaleString()}`
              : "No results entered yet"}
          </p>
        </div>

        {authUser ? (
          <button
            onClick={signOut}
            className="w-full rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 sm:w-auto"
          >
            Sign Out
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Admin Access
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {authUser ? "Signed In" : "Commissioner Sign In Required"}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {authUser?.email ?? "Not signed in"}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-700">
              {signedInMember
                ? `${signedInMember.display_name} • ${signedInMember.role}`
                : authUser
                ? "Signed in, but not mapped to a league member"
                : ""}
            </div>
          </div>
        </div>

        {!authUser ? (
          <div className="mt-5 max-w-md rounded-xl border bg-slate-50 p-4">
            <div className="text-base font-semibold">Commissioner Email Login</div>
            <div className="mt-1 text-sm text-slate-600">
              Sign in with your commissioner email and password
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your commissioner email"
              className="mt-4 w-full rounded-xl border px-3 py-2"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-3 w-full rounded-xl border px-3 py-2"
            />

            <button
              onClick={signInWithPassword}
              disabled={isSigningIn}
              className="mt-3 rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {isSigningIn ? "Signing In..." : "Sign In"}
            </button>
          </div>
        ) : null}

        {renderStatusBanner()}
      </section>

      {authUser && !isCommissioner ? (
        <section className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          Only the commissioner has access to admin controls.
        </section>
      ) : null}

      {isCommissioner ? (
        <>
          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Live Sync Engine</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pull ESPN scoreboard data, map teams, and promote final games into official results.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div>
                  <label
                    htmlFor="syncDate"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Sync Date
                  </label>
                  <input
                    id="syncDate"
                    type="text"
                    value={syncDate}
                    onChange={(e) => setSyncDate(e.target.value)}
                    placeholder="YYYYMMDD"
                    className="w-full rounded-xl border px-3 py-2 sm:w-[160px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={runSyncCycle}
                  disabled={isRunningSyncCycle}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunningSyncCycle ? "Running Sync..." : "Run Sync Cycle"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold">Draft Lottery</h2>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm text-slate-600">
                    Equal odds for all four managers. Reveals 4th, 3rd, 2nd, then 1st.
                  </div>
                  {lotteryLocked ? (
                    <div className="mt-2 text-sm font-medium text-red-600">
                      Lottery is locked once picks have been made.
                    </div>
                  ) : null}
                </div>

                <button
                  onClick={runDraftLottery}
                  disabled={isRunningLottery || lotteryLocked}
                  className="rounded-xl bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRunningLottery ? "Running..." : "Run Draft Lottery"}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                {[4, 3, 2, 1].map((slot) => {
                  const member = lotteryResults[slot as LotteryRevealSlot];

                  return (
                    <div
                      key={slot}
                      className="rounded-xl border bg-slate-50 p-4 text-center"
                    >
                      <div className="text-xs text-slate-500">Pick #{slot}</div>
                      <div className="mt-3 text-3xl font-bold text-slate-900">
                        {member ? member.display_name : "Waiting"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-semibold">Record Game Result</h2>

              <form onSubmit={submitResult} className="mt-4 space-y-4">
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
              </form>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-semibold">Commissioner Tools</h2>

              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="font-semibold text-amber-900">
                        Archive Current Season Standings
                      </h3>
                      <p className="mt-1 text-sm text-amber-800">
                        Save a permanent historical snapshot before resetting the league.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="w-full sm:max-w-[180px]">
                        <label
                          htmlFor="seasonYear"
                          className="mb-1 block text-xs font-medium uppercase tracking-wide text-amber-900"
                        >
                          Season Year
                        </label>
                        <input
                          id="seasonYear"
                          type="number"
                          value={seasonYear}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setSeasonYear(Number.isNaN(value) ? 2026 : value);
                          }}
                          className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={archiveSeason}
                        className="w-full rounded-xl bg-amber-600 px-4 py-3 text-left font-medium text-white hover:bg-amber-700 sm:w-auto"
                      >
                        Archive Season
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetLeague}
                  className="w-full rounded-xl border border-red-300 px-4 py-3 text-left text-red-600 hover:bg-red-50"
                >
                  Reset Draft + Results
                </button>

                <Link
                  href="/draft"
                  className="rounded-xl border px-4 py-3 hover:bg-slate-50"
                >
                  Draft Room
                </Link>

                <Link
                  href="/results"
                  className="rounded-xl border px-4 py-3 hover:bg-slate-50"
                >
                  Results Entry
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

                <Link
                  href="/seasons"
                  className="rounded-xl border px-4 py-3 hover:bg-slate-50"
                >
                  Seasons Archive
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold">Recent Results</h2>

            <div className="mt-4 space-y-3">
              {games.length === 0 ? (
                <div className="rounded-xl border p-4 text-sm text-slate-500">
                  No results entered yet.
                </div>
              ) : (
                games.slice(0, 10).map((game) => {
                  const winner =
                    teamMap.get(game.winning_team_id ?? "") ?? "Unknown winner";
                  const loser =
                    teamMap.get(game.losing_team_id ?? "") ?? "Unknown loser";

                  return (
                    <div
                      key={game.id}
                      className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="text-sm text-slate-500">{game.round_name}</div>

                        <div className="mt-2 flex flex-col gap-2 font-semibold sm:flex-row sm:flex-wrap sm:items-center">
                          <div className="flex items-center gap-2">
                            <TeamLogo teamName={winner} size={24} />
                            <span>{winner}</span>
                          </div>

                          <span className="text-slate-400">defeated</span>

                          <div className="flex items-center gap-2">
                            <TeamLogo teamName={loser} size={24} />
                            <span>{loser}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteResult(game.id)}
                        className="w-full rounded-lg border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50 sm:w-auto"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold">Current League Members</h2>

            <div className="mt-4 space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div className="flex items-center gap-3">
                    <ManagerBadge name={member.display_name} />
                    <div>
                      <div className="font-semibold">{member.display_name}</div>
                      <div className="text-sm text-slate-600">
                        {member.email ?? "—"} • {member.role ?? "—"}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-600">
                    Slot #{member.draft_slot}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}