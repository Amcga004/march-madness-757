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

type MatchupTeam = {
  id: string | null;
  name: string;
  seed: number | null;
  region: string | null;
};

type GuidedMatchup = {
  key: string;
  roundName: string;
  regionLabel: string;
  top: MatchupTeam;
  bottom: MatchupTeam;
  winnerId: string | null;
  loserId: string | null;
};

const ROUNDS = [
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite Eight",
  "Final Four",
  "Championship",
] as const;

const REGIONS = ["East", "West", "South", "Midwest"] as const;

const ROUND_OF_64_PAIRS = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
] as const;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyTeam(): MatchupTeam {
  return {
    id: null,
    name: "TBD",
    seed: null,
    region: null,
  };
}

function buildTeam(team?: Team): MatchupTeam {
  if (!team) return emptyTeam();

  return {
    id: team.id,
    name: team.school_name,
    seed: team.seed,
    region: team.region,
  };
}

function findGameForTeams(
  games: Game[],
  roundName: string,
  teamAId: string | null,
  teamBId: string | null
) {
  if (!teamAId || !teamBId) return null;

  return (
    games.find((game) => {
      if (game.round_name !== roundName) return false;
      const ids = [game.winning_team_id, game.losing_team_id];
      return ids.includes(teamAId) && ids.includes(teamBId);
    }) ?? null
  );
}

function winnerFromGame(
  game: Game | null,
  teamAId: string | null,
  teamBId: string | null
) {
  if (!game) return null;
  if (game.winning_team_id === teamAId) return teamAId;
  if (game.winning_team_id === teamBId) return teamBId;
  return null;
}

function loserFromGame(
  game: Game | null,
  teamAId: string | null,
  teamBId: string | null
) {
  if (!game) return null;
  if (game.losing_team_id === teamAId) return teamAId;
  if (game.losing_team_id === teamBId) return teamBId;
  return null;
}

function winnerTeamFromMatchup(matchup: GuidedMatchup): MatchupTeam {
  if (matchup.winnerId === matchup.top.id) return matchup.top;
  if (matchup.winnerId === matchup.bottom.id) return matchup.bottom;
  return emptyTeam();
}

function buildRegionRounds(regionTeams: Team[], games: Game[], region: string) {
  const seedMap = new Map(regionTeams.map((team) => [team.seed, team]));

  const round64: GuidedMatchup[] = ROUND_OF_64_PAIRS.map(([seedA, seedB]) => {
    const teamA = buildTeam(seedMap.get(seedA));
    const teamB = buildTeam(seedMap.get(seedB));
    const game = findGameForTeams(games, "Round of 64", teamA.id, teamB.id);

    return {
      key: `Round of 64-${region}-${seedA}-${seedB}`,
      roundName: "Round of 64",
      regionLabel: region,
      top: teamA,
      bottom: teamB,
      winnerId: winnerFromGame(game, teamA.id, teamB.id),
      loserId: loserFromGame(game, teamA.id, teamB.id),
    };
  });

  const round32: GuidedMatchup[] = [];
  for (let i = 0; i < round64.length; i += 2) {
    const leftWinner = winnerTeamFromMatchup(round64[i]);
    const rightWinner = winnerTeamFromMatchup(round64[i + 1]);
    const game = findGameForTeams(games, "Round of 32", leftWinner.id, rightWinner.id);

    round32.push({
      key: `Round of 32-${region}-${i}`,
      roundName: "Round of 32",
      regionLabel: region,
      top: leftWinner,
      bottom: rightWinner,
      winnerId: winnerFromGame(game, leftWinner.id, rightWinner.id),
      loserId: loserFromGame(game, leftWinner.id, rightWinner.id),
    });
  }

  const sweet16: GuidedMatchup[] = [];
  for (let i = 0; i < round32.length; i += 2) {
    const leftWinner = winnerTeamFromMatchup(round32[i]);
    const rightWinner = winnerTeamFromMatchup(round32[i + 1]);
    const game = findGameForTeams(games, "Sweet 16", leftWinner.id, rightWinner.id);

    sweet16.push({
      key: `Sweet 16-${region}-${i}`,
      roundName: "Sweet 16",
      regionLabel: region,
      top: leftWinner,
      bottom: rightWinner,
      winnerId: winnerFromGame(game, leftWinner.id, rightWinner.id),
      loserId: loserFromGame(game, leftWinner.id, rightWinner.id),
    });
  }

  const elite8: GuidedMatchup[] = [];
  for (let i = 0; i < sweet16.length; i += 2) {
    const leftWinner = winnerTeamFromMatchup(sweet16[i]);
    const rightWinner = winnerTeamFromMatchup(sweet16[i + 1]);
    const game = findGameForTeams(games, "Elite Eight", leftWinner.id, rightWinner.id);

    elite8.push({
      key: `Elite Eight-${region}-${i}`,
      roundName: "Elite Eight",
      regionLabel: region,
      top: leftWinner,
      bottom: rightWinner,
      winnerId: winnerFromGame(game, leftWinner.id, rightWinner.id),
      loserId: loserFromGame(game, leftWinner.id, rightWinner.id),
    });
  }

  return {
    round64,
    round32,
    sweet16,
    elite8,
    champion: elite8.length > 0 ? winnerTeamFromMatchup(elite8[0]) : emptyTeam(),
  };
}

function buildFinalRoundMatchup(
  games: Game[],
  roundName: string,
  regionLabel: string,
  top: MatchupTeam,
  bottom: MatchupTeam
): GuidedMatchup {
  const game = findGameForTeams(games, roundName, top.id, bottom.id);

  return {
    key: `${roundName}-${regionLabel}-${top.id ?? "tbd"}-${bottom.id ?? "tbd"}`,
    roundName,
    regionLabel,
    top,
    bottom,
    winnerId: winnerFromGame(game, top.id, bottom.id),
    loserId: loserFromGame(game, top.id, bottom.id),
  };
}

function buildGuidedMatchups(teams: Team[], games: Game[]) {
  const regionData = REGIONS.map((region) => {
    const teamsForRegion = teams.filter((team) => team.region === region);
    return {
      region,
      ...buildRegionRounds(teamsForRegion, games, region),
    };
  });

  const eastChampion =
    regionData.find((r) => r.region === "East")?.champion ?? emptyTeam();
  const westChampion =
    regionData.find((r) => r.region === "West")?.champion ?? emptyTeam();
  const southChampion =
    regionData.find((r) => r.region === "South")?.champion ?? emptyTeam();
  const midwestChampion =
    regionData.find((r) => r.region === "Midwest")?.champion ?? emptyTeam();

  const finalFour1 = buildFinalRoundMatchup(
    games,
    "Final Four",
    "East vs West",
    eastChampion,
    westChampion
  );

  const finalFour2 = buildFinalRoundMatchup(
    games,
    "Final Four",
    "South vs Midwest",
    southChampion,
    midwestChampion
  );

  const championship = buildFinalRoundMatchup(
    games,
    "Championship",
    "National Championship",
    winnerTeamFromMatchup(finalFour1),
    winnerTeamFromMatchup(finalFour2)
  );

  return {
    "Round of 64": regionData.flatMap((r) => r.round64),
    "Round of 32": regionData.flatMap((r) => r.round32),
    "Sweet 16": regionData.flatMap((r) => r.sweet16),
    "Elite Eight": regionData.flatMap((r) => r.elite8),
    "Final Four": [finalFour1, finalFour2],
    Championship: [championship],
  } as Record<string, GuidedMatchup[]>;
}

function ResultEntryCard({
  matchup,
  onSelectWinner,
  isLoading,
}: {
  matchup: GuidedMatchup;
  onSelectWinner: (winnerTeamId: string, loserTeamId: string, roundName: string) => void;
  isLoading: boolean;
}) {
  const teamsReady = !!matchup.top.id && !!matchup.bottom.id;
  const alreadyRecorded = !!matchup.winnerId;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {matchup.regionLabel}
          </div>
          <div className="mt-1 text-sm text-slate-600">{matchup.roundName}</div>
        </div>

        {alreadyRecorded ? (
          <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            Complete
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            Pending
          </span>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          disabled={!teamsReady || alreadyRecorded || isLoading || !matchup.top.id || !matchup.bottom.id}
          onClick={() =>
            matchup.top.id &&
            matchup.bottom.id &&
            onSelectWinner(matchup.top.id, matchup.bottom.id, matchup.roundName)
          }
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <TeamLogo teamName={matchup.top.name} size={28} />
            <div>
              <div className="font-semibold text-slate-900">
                {matchup.top.seed ? `${matchup.top.seed}. ` : ""}
                {matchup.top.name}
              </div>
              <div className="text-sm text-slate-500">Mark as winner</div>
            </div>
          </div>

          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Win
          </span>
        </button>

        <button
          type="button"
          disabled={!teamsReady || alreadyRecorded || isLoading || !matchup.top.id || !matchup.bottom.id}
          onClick={() =>
            matchup.top.id &&
            matchup.bottom.id &&
            onSelectWinner(matchup.bottom.id, matchup.top.id, matchup.roundName)
          }
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <TeamLogo teamName={matchup.bottom.name} size={28} />
            <div>
              <div className="font-semibold text-slate-900">
                {matchup.bottom.seed ? `${matchup.bottom.seed}. ` : ""}
                {matchup.bottom.name}
              </div>
              <div className="text-sm text-slate-500">Mark as winner</div>
            </div>
          </div>

          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Win
          </span>
        </button>
      </div>

      {!teamsReady ? (
        <div className="mt-3 text-sm text-slate-500">
          Waiting for prior round results before this matchup becomes available.
        </div>
      ) : null}
    </div>
  );
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

  const [roundName, setRoundName] = useState<string>("Round of 64");
  const [seasonYear, setSeasonYear] = useState<number>(2026);

  const [isRunningLottery, setIsRunningLottery] = useState(false);
  const [lotteryResults, setLotteryResults] = useState<
    Partial<Record<LotteryRevealSlot, Member>>
  >({});
  const [status, setStatus] = useState<StatusType>("idle");
  const [message, setMessage] = useState("");

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

  const guidedMatchups = useMemo(() => {
    return buildGuidedMatchups(teams, games);
  }, [teams, games]);

  const pendingMatchupsForRound = useMemo(() => {
    return (guidedMatchups[roundName] ?? []).filter(
      (matchup) =>
        !!matchup.top.id &&
        !!matchup.bottom.id &&
        !matchup.winnerId &&
        !matchup.loserId
    );
  }, [guidedMatchups, roundName]);

  const completedMatchupsForRound = useMemo(() => {
    return (guidedMatchups[roundName] ?? []).filter(
      (matchup) => !!matchup.winnerId
    );
  }, [guidedMatchups, roundName]);

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

  async function submitMatchupResult(
    winnerTeamId: string,
    loserTeamId: string,
    selectedRoundName: string
  ) {
    if (!isCommissioner) {
      setStatusMessage("error", "Only the commissioner can record results.");
      return;
    }

    if (!league) {
      setStatusMessage("error", "League not found.");
      return;
    }

    const winnerName = teamMap.get(winnerTeamId) ?? "Winner";
    const loserName = teamMap.get(loserTeamId) ?? "Loser";

    const confirmed = window.confirm(
      `Record result: ${winnerName} defeated ${loserName} in ${selectedRoundName}?`
    );
    if (!confirmed) return;

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
          roundName: selectedRoundName,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        setStatusMessage("error", result.error || "Failed to save result.");
        return;
      }

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
      setRoundName("Round of 64");
      setLotteryResults({});
      setStatusMessage("success", "League reset complete.");
    } catch {
      setStatusMessage("error", "Reset failed.");
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
            Commissioner controls for lottery, guided results entry, season archive, and league maintenance.
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Guided Result Entry</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Select a round, then tap the winning team from each valid matchup.
                  </p>
                </div>

                <div className="w-full sm:w-[220px]">
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
              </div>

              <div className="mt-5 grid gap-4">
                {pendingMatchupsForRound.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    No pending matchups are currently available for {roundName}.
                  </div>
                ) : (
                  pendingMatchupsForRound.map((matchup) => (
                    <ResultEntryCard
                      key={matchup.key}
                      matchup={matchup}
                      isLoading={status === "loading"}
                      onSelectWinner={submitMatchupResult}
                    />
                  ))
                )}
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Round Progress
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Pending: <span className="font-semibold">{pendingMatchupsForRound.length}</span>
                  <span className="mx-2 text-slate-400">•</span>
                  Completed: <span className="font-semibold">{completedMatchupsForRound.length}</span>
                </div>
              </div>
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
                  Results Page
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