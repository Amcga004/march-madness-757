export type ForecastMember = {
  id: string;
  display_name: string;
  draft_slot: number;
};

export type ForecastPick = {
  id: string;
  member_id: string;
  team_id: string;
  overall_pick?: number;
};

export type ForecastTeam = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

export type ForecastTeamResult = {
  id: string;
  team_id: string;
  total_points: number;
  eliminated: boolean;
};

export type ForecastGame = {
  id?: string;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  created_at?: string;
};

export type ManagerForecast = {
  memberId: string;
  displayName: string;
  draftSlot: number;
  currentPoints: number;
  liveTeams: number;
  eliminatedTeams: number;
  remainingUpside: number;
  maxFinalPoints: number;
};

type OwnedTeam = ForecastTeam & {
  managerId: string | null;
};

type Node =
  | {
      kind: "team";
      team: OwnedTeam;
    }
  | {
      kind: "matchup";
      roundName: string;
      pointsForWin: number;
      winnerId: string | null;
      top: Node;
      bottom: Node;
    };

type WinnerScoreMap = Map<string, number>;

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

const ROUND_POINTS: Record<string, number> = {
  "Round of 64": 2,
  "Round of 32": 4,
  "Sweet 16": 7,
  "Elite Eight": 13,
  "Final Four": 20,
  Championship: 37,
};

function emptyScoreMap(): WinnerScoreMap {
  return new Map<string, number>();
}

function winnerIdFromNode(node: Node): string | null {
  if (node.kind === "team") return node.team.id;
  return node.winnerId;
}

function collectTeams(node: Node): OwnedTeam[] {
  if (node.kind === "team") return [node.team];
  return [...collectTeams(node.top), ...collectTeams(node.bottom)];
}

function findTeamManagerId(node: Node, teamId: string): string | null {
  const team = collectTeams(node).find((entry) => entry.id === teamId);
  return team?.managerId ?? null;
}

function findGameForTeams(
  games: ForecastGame[],
  roundName: string,
  teamAId: string | null,
  teamBId: string | null
): ForecastGame | null {
  if (!teamAId || !teamBId) return null;

  return (
    games.find((game) => {
      if (game.round_name !== roundName) return false;
      const ids = [game.winning_team_id, game.losing_team_id];
      return ids.includes(teamAId) && ids.includes(teamBId);
    }) ?? null
  );
}

function setIfHigher(map: WinnerScoreMap, teamId: string, value: number) {
  const existing = map.get(teamId);
  if (existing === undefined || value > existing) {
    map.set(teamId, value);
  }
}

function maxMapValue(map: WinnerScoreMap): number {
  if (map.size === 0) return 0;
  return Math.max(...Array.from(map.values()));
}

function solveNode(node: Node, managerId: string): WinnerScoreMap {
  if (node.kind === "team") {
    const result = emptyScoreMap();
    result.set(node.team.id, 0);
    return result;
  }

  const topMap = solveNode(node.top, managerId);
  const bottomMap = solveNode(node.bottom, managerId);
  const result = emptyScoreMap();

  if (node.winnerId) {
    const winnerInTop = topMap.has(node.winnerId);
    const winnerInBottom = bottomMap.has(node.winnerId);

    if (winnerInTop) {
      const fixedTop = topMap.get(node.winnerId) ?? 0;
      const bestBottom = maxMapValue(bottomMap);
      result.set(node.winnerId, fixedTop + bestBottom);
    }

    if (winnerInBottom) {
      const fixedBottom = bottomMap.get(node.winnerId) ?? 0;
      const bestTop = maxMapValue(topMap);
      result.set(node.winnerId, fixedBottom + bestTop);
    }

    return result;
  }

  for (const [topWinnerId, topScore] of topMap.entries()) {
    for (const [, bottomScore] of bottomMap.entries()) {
      const bonus =
        findTeamManagerId(node, topWinnerId) === managerId ? node.pointsForWin : 0;
      setIfHigher(result, topWinnerId, topScore + bottomScore + bonus);
    }
  }

  for (const [, topScore] of topMap.entries()) {
    for (const [bottomWinnerId, bottomScore] of bottomMap.entries()) {
      const bonus =
        findTeamManagerId(node, bottomWinnerId) === managerId ? node.pointsForWin : 0;
      setIfHigher(result, bottomWinnerId, topScore + bottomScore + bonus);
    }
  }

  return result;
}

function buildRegionTree(regionTeams: OwnedTeam[], games: ForecastGame[]): Node {
  const seedMap = new Map<number, OwnedTeam>(regionTeams.map((team) => [team.seed, team]));

  const round64: Node[] = ROUND_OF_64_PAIRS.map(([seedA, seedB]) => {
    const topTeam = seedMap.get(seedA);
    const bottomTeam = seedMap.get(seedB);

    if (!topTeam || !bottomTeam) {
      throw new Error(`Missing seeded teams in region ${regionTeams[0]?.region ?? "unknown"}`);
    }

    const game = findGameForTeams(games, "Round of 64", topTeam.id, bottomTeam.id);

    return {
      kind: "matchup",
      roundName: "Round of 64",
      pointsForWin: ROUND_POINTS["Round of 64"],
      winnerId: game?.winning_team_id ?? null,
      top: { kind: "team", team: topTeam },
      bottom: { kind: "team", team: bottomTeam },
    };
  });

  const round32: Node[] = [];
  for (let i = 0; i < round64.length; i += 2) {
    const left = round64[i];
    const right = round64[i + 1];
    const game = findGameForTeams(
      games,
      "Round of 32",
      winnerIdFromNode(left),
      winnerIdFromNode(right)
    );

    round32.push({
      kind: "matchup",
      roundName: "Round of 32",
      pointsForWin: ROUND_POINTS["Round of 32"],
      winnerId: game?.winning_team_id ?? null,
      top: left,
      bottom: right,
    });
  }

  const sweet16: Node[] = [];
  for (let i = 0; i < round32.length; i += 2) {
    const left = round32[i];
    const right = round32[i + 1];
    const game = findGameForTeams(
      games,
      "Sweet 16",
      winnerIdFromNode(left),
      winnerIdFromNode(right)
    );

    sweet16.push({
      kind: "matchup",
      roundName: "Sweet 16",
      pointsForWin: ROUND_POINTS["Sweet 16"],
      winnerId: game?.winning_team_id ?? null,
      top: left,
      bottom: right,
    });
  }

  const elite8: Node[] = [];
  for (let i = 0; i < sweet16.length; i += 2) {
    const left = sweet16[i];
    const right = sweet16[i + 1];
    const game = findGameForTeams(
      games,
      "Elite Eight",
      winnerIdFromNode(left),
      winnerIdFromNode(right)
    );

    elite8.push({
      kind: "matchup",
      roundName: "Elite Eight",
      pointsForWin: ROUND_POINTS["Elite Eight"],
      winnerId: game?.winning_team_id ?? null,
      top: left,
      bottom: right,
    });
  }

  return elite8[0];
}

function buildTournamentTree(teams: OwnedTeam[], games: ForecastGame[]): Node {
  const east = buildRegionTree(
    teams.filter((team) => team.region === "East"),
    games
  );
  const west = buildRegionTree(
    teams.filter((team) => team.region === "West"),
    games
  );
  const south = buildRegionTree(
    teams.filter((team) => team.region === "South"),
    games
  );
  const midwest = buildRegionTree(
    teams.filter((team) => team.region === "Midwest"),
    games
  );

  const semifinal1Game = findGameForTeams(
    games,
    "Final Four",
    winnerIdFromNode(east),
    winnerIdFromNode(west)
  );

  const semifinal2Game = findGameForTeams(
    games,
    "Final Four",
    winnerIdFromNode(south),
    winnerIdFromNode(midwest)
  );

  const semifinal1: Node = {
    kind: "matchup",
    roundName: "Final Four",
    pointsForWin: ROUND_POINTS["Final Four"],
    winnerId: semifinal1Game?.winning_team_id ?? null,
    top: east,
    bottom: west,
  };

  const semifinal2: Node = {
    kind: "matchup",
    roundName: "Final Four",
    pointsForWin: ROUND_POINTS["Final Four"],
    winnerId: semifinal2Game?.winning_team_id ?? null,
    top: south,
    bottom: midwest,
  };

  const championshipGame = findGameForTeams(
    games,
    "Championship",
    winnerIdFromNode(semifinal1),
    winnerIdFromNode(semifinal2)
  );

  return {
    kind: "matchup",
    roundName: "Championship",
    pointsForWin: ROUND_POINTS["Championship"],
    winnerId: championshipGame?.winning_team_id ?? null,
    top: semifinal1,
    bottom: semifinal2,
  };
}

export function computeLeagueForecasts(args: {
  members: ForecastMember[];
  picks: ForecastPick[];
  teams: ForecastTeam[];
  teamResults: ForecastTeamResult[];
  games: ForecastGame[];
}): ManagerForecast[] {
  const { members, picks, teams, teamResults, games } = args;

  const managerByTeamId = new Map<string, string>();
  for (const pick of picks) {
    managerByTeamId.set(pick.team_id, pick.member_id);
  }

  const ownedTeams: OwnedTeam[] = teams.map((team) => ({
    ...team,
    managerId: managerByTeamId.get(team.id) ?? null,
  }));

  const tournamentTree = buildTournamentTree(ownedTeams, games);
  const resultByTeamId = new Map<string, ForecastTeamResult>(
    teamResults.map((result) => [result.team_id, result])
  );

  return [...members]
    .sort((a, b) => a.draft_slot - b.draft_slot)
    .map((member) => {
      const memberPicks = picks.filter((pick) => pick.member_id === member.id);

      const currentPoints = memberPicks.reduce((sum, pick) => {
        return sum + (resultByTeamId.get(pick.team_id)?.total_points ?? 0);
      }, 0);

      const liveTeams = memberPicks.filter((pick) => {
        const result = resultByTeamId.get(pick.team_id);
        return result ? result.eliminated === false : true;
      }).length;

      const eliminatedTeams = memberPicks.length - liveTeams;

      const solved = solveNode(tournamentTree, member.id);
      const remainingUpside = maxMapValue(solved);
      const maxFinalPoints = currentPoints + remainingUpside;

      return {
        memberId: member.id,
        displayName: member.display_name,
        draftSlot: member.draft_slot,
        currentPoints,
        liveTeams,
        eliminatedTeams,
        remainingUpside,
        maxFinalPoints,
      };
    });
}