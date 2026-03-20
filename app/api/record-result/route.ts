import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCORING: Record<string, number> = {
  "Round of 64": 2,
  "Round of 32": 5,
  "Sweet 16": 10,
  "Elite Eight": 17,
  "Final Four": 25,
  Championship: 35,
};

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

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type Game = {
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
};

type MatchupTeam = {
  id: string | null;
  name: string;
  seed: number | null;
  region: string | null;
};

type Matchup = {
  roundName: string;
  top: MatchupTeam;
  bottom: MatchupTeam;
  winnerId: string | null;
  loserId: string | null;
};

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

function winnerTeamFromMatchup(matchup: Matchup): MatchupTeam {
  if (matchup.winnerId === matchup.top.id) return matchup.top;
  if (matchup.winnerId === matchup.bottom.id) return matchup.bottom;
  return emptyTeam();
}

function buildRegionRounds(regionTeams: Team[], games: Game[]) {
  const seedMap = new Map(regionTeams.map((team) => [team.seed, team]));

  const round64: Matchup[] = ROUND_OF_64_PAIRS.map(([seedA, seedB]) => {
    const top = buildTeam(seedMap.get(seedA));
    const bottom = buildTeam(seedMap.get(seedB));
    const game = findGameForTeams(games, "Round of 64", top.id, bottom.id);

    return {
      roundName: "Round of 64",
      top,
      bottom,
      winnerId: winnerFromGame(game, top.id, bottom.id),
      loserId: loserFromGame(game, top.id, bottom.id),
    };
  });

  const round32: Matchup[] = [];
  for (let i = 0; i < round64.length; i += 2) {
    const leftWinner = winnerTeamFromMatchup(round64[i]);
    const rightWinner = winnerTeamFromMatchup(round64[i + 1]);
    const game = findGameForTeams(games, "Round of 32", leftWinner.id, rightWinner.id);

    round32.push({
      roundName: "Round of 32",
      top: leftWinner,
      bottom: rightWinner,
      winnerId: winnerFromGame(game, leftWinner.id, rightWinner.id),
      loserId: loserFromGame(game, leftWinner.id, rightWinner.id),
    });
  }

  const sweet16: Matchup[] = [];
  for (let i = 0; i < round32.length; i += 2) {
    const leftWinner = winnerTeamFromMatchup(round32[i]);
    const rightWinner = winnerTeamFromMatchup(round32[i + 1]);
    const game = findGameForTeams(games, "Sweet 16", leftWinner.id, rightWinner.id);

    sweet16.push({
      roundName: "Sweet 16",
      top: leftWinner,
      bottom: rightWinner,
      winnerId: winnerFromGame(game, leftWinner.id, rightWinner.id),
      loserId: loserFromGame(game, leftWinner.id, rightWinner.id),
    });
  }

  const elite8: Matchup[] = [];
  for (let i = 0; i < sweet16.length; i += 2) {
    const leftWinner = winnerTeamFromMatchup(sweet16[i]);
    const rightWinner = winnerTeamFromMatchup(sweet16[i + 1]);
    const game = findGameForTeams(games, "Elite Eight", leftWinner.id, rightWinner.id);

    elite8.push({
      roundName: "Elite Eight",
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
  top: MatchupTeam,
  bottom: MatchupTeam
): Matchup {
  const game = findGameForTeams(games, roundName, top.id, bottom.id);

  return {
    roundName,
    top,
    bottom,
    winnerId: winnerFromGame(game, top.id, bottom.id),
    loserId: loserFromGame(game, top.id, bottom.id),
  };
}

function buildAllValidMatchups(teams: Team[], games: Game[]) {
  const regionData = REGIONS.map((region) => {
    const teamsForRegion = teams.filter((team) => team.region === region);
    return {
      region,
      ...buildRegionRounds(teamsForRegion, games),
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

  const semifinal1 = buildFinalRoundMatchup(
    games,
    "Final Four",
    eastChampion,
    westChampion
  );
  const semifinal2 = buildFinalRoundMatchup(
    games,
    "Final Four",
    southChampion,
    midwestChampion
  );

  const championship = buildFinalRoundMatchup(
    games,
    "Championship",
    winnerTeamFromMatchup(semifinal1),
    winnerTeamFromMatchup(semifinal2)
  );

  return {
    "Round of 64": regionData.flatMap((r) => r.round64),
    "Round of 32": regionData.flatMap((r) => r.round32),
    "Sweet 16": regionData.flatMap((r) => r.sweet16),
    "Elite Eight": regionData.flatMap((r) => r.elite8),
    "Final Four": [semifinal1, semifinal2],
    Championship: [championship],
  } as Record<string, Matchup[]>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const { leagueId, winnerTeamId, loserTeamId, roundName } = body;

    if (!leagueId || !winnerTeamId || !loserTeamId || !roundName) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (winnerTeamId === loserTeamId) {
      return NextResponse.json(
        { ok: false, error: "Winner and loser cannot be the same team." },
        { status: 400 }
      );
    }

    const [{ data: teams, error: teamsError }, { data: games, error: gamesError }] =
      await Promise.all([
        supabase
          .from("teams")
          .select("id, school_name, seed, region")
          .order("region", { ascending: true })
          .order("seed", { ascending: true }),
        supabase
          .from("games")
          .select("round_name, winning_team_id, losing_team_id")
          .eq("league_id", leagueId),
      ]);

    if (teamsError) {
      return NextResponse.json(
        { ok: false, error: teamsError.message },
        { status: 500 }
      );
    }

    if (gamesError) {
      return NextResponse.json(
        { ok: false, error: gamesError.message },
        { status: 500 }
      );
    }

    const typedTeams = (teams ?? []) as Team[];
    const typedGames = (games ?? []) as Game[];

    const validMatchups = buildAllValidMatchups(typedTeams, typedGames)[roundName] ?? [];

    const isValidMatchup = validMatchups.some((matchup) => {
      const topId = matchup.top.id;
      const bottomId = matchup.bottom.id;

      return (
        !!topId &&
        !!bottomId &&
        ((topId === winnerTeamId && bottomId === loserTeamId) ||
          (topId === loserTeamId && bottomId === winnerTeamId))
      );
    });

    if (!isValidMatchup) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "That matchup is not currently valid for the selected round. Make sure prior round results are entered first.",
        },
        { status: 400 }
      );
    }

    const existingPairing = typedGames.find((game) => {
      if (game.round_name !== roundName) return false;
      const ids = [game.winning_team_id, game.losing_team_id];
      return ids.includes(winnerTeamId) && ids.includes(loserTeamId);
    });

    if (existingPairing) {
      return NextResponse.json(
        { ok: false, error: "That game result has already been recorded." },
        { status: 400 }
      );
    }

    const points = SCORING[roundName] ?? 0;

    const { error: gameError } = await supabase.from("games").insert({
      league_id: leagueId,
      external_game_id: crypto.randomUUID(),
      round_name: roundName,
      winning_team_id: winnerTeamId,
      losing_team_id: loserTeamId,
      status: "complete",
    });

    if (gameError) {
      return NextResponse.json(
        { ok: false, error: gameError.message },
        { status: 500 }
      );
    }

    const { data: winnerExisting } = await supabase
      .from("team_results")
      .select("*")
      .eq("league_id", leagueId)
      .eq("team_id", winnerTeamId)
      .maybeSingle();

    const { data: loserExisting } = await supabase
      .from("team_results")
      .select("*")
      .eq("league_id", leagueId)
      .eq("team_id", loserTeamId)
      .maybeSingle();

    const { error: winnerError } = await supabase.from("team_results").upsert(
      {
        league_id: leagueId,
        team_id: winnerTeamId,
        eliminated: false,
        total_points: (winnerExisting?.total_points ?? 0) + points,
      },
      { onConflict: "league_id,team_id" }
    );

    if (winnerError) {
      return NextResponse.json(
        { ok: false, error: winnerError.message },
        { status: 500 }
      );
    }

    const { error: loserError } = await supabase.from("team_results").upsert(
      {
        league_id: leagueId,
        team_id: loserTeamId,
        eliminated: true,
        total_points: loserExisting?.total_points ?? 0,
      },
      { onConflict: "league_id,team_id" }
    );

    if (loserError) {
      return NextResponse.json(
        { ok: false, error: loserError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to record result." },
      { status: 500 }
    );
  }
}