import { createClient } from "@/lib/supabase/server";

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
};

type Pick = {
  id: string;
  member_id: string;
  team_id: string;
};

type Member = {
  id: string;
  display_name: string;
};

type MatchupTeam = {
  id: string | null;
  name: string;
  seed: number | null;
  manager: string | null;
};

type Matchup = {
  top: MatchupTeam;
  bottom: MatchupTeam;
  winnerId: string | null;
  loserId: string | null;
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
];

const MANAGER_STYLES: Record<string, string> = {
  Andrew: "bg-blue-100 text-blue-700 border-blue-200",
  Wesley: "bg-green-100 text-green-700 border-green-200",
  Eric: "bg-purple-100 text-purple-700 border-purple-200",
  Greg: "bg-orange-100 text-orange-700 border-orange-200",
};

function emptyTeam(): MatchupTeam {
  return {
    id: null,
    name: "TBD",
    seed: null,
    manager: null,
  };
}

function buildTeam(team?: Team, manager?: string | null): MatchupTeam {
  if (!team) return emptyTeam();

  return {
    id: team.id,
    name: team.school_name,
    seed: team.seed,
    manager: manager ?? null,
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

function buildRegionBracket(
  regionTeams: Team[],
  games: Game[],
  managerByTeamId: Map<string, string>
) {
  const seedMap = new Map(regionTeams.map((team) => [team.seed, team]));

  const round64: Matchup[] = ROUND_OF_64_PAIRS.map(([seedA, seedB]) => {
    const teamA = seedMap.get(seedA);
    const teamB = seedMap.get(seedB);
    const top = buildTeam(teamA, teamA ? managerByTeamId.get(teamA.id) ?? null : null);
    const bottom = buildTeam(teamB, teamB ? managerByTeamId.get(teamB.id) ?? null : null);
    const game = findGameForTeams(games, "Round of 64", top.id, bottom.id);

    return {
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
      top: leftWinner,
      bottom: rightWinner,
      winnerId: winnerFromGame(game, leftWinner.id, rightWinner.id),
      loserId: loserFromGame(game, leftWinner.id, rightWinner.id),
    });
  }

  const regionChampion = elite8.length > 0 ? winnerTeamFromMatchup(elite8[0]) : emptyTeam();

  return {
    round64,
    round32,
    sweet16,
    elite8,
    champion: regionChampion,
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
    top,
    bottom,
    winnerId: winnerFromGame(game, top.id, bottom.id),
    loserId: loserFromGame(game, top.id, bottom.id),
  };
}

function ManagerTag({ manager }: { manager: string | null }) {
  if (!manager) return null;

  return (
    <span
      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        MANAGER_STYLES[manager] ?? "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {manager}
    </span>
  );
}

function TeamLine({
  team,
  isWinner,
  isLoser,
}: {
  team: MatchupTeam;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const winnerClasses = isWinner
    ? "border-green-300 bg-green-50 text-green-800"
    : "";
  const loserClasses = isLoser
    ? "border-red-300 bg-red-50 text-red-700 line-through"
    : "";
  const baseClasses =
    !isWinner && !isLoser ? "border-slate-200 bg-white text-slate-800" : "";

  return (
    <div
      className={`rounded-lg border px-3 py-2 transition ${winnerClasses} ${loserClasses} ${baseClasses}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="truncate text-sm font-medium">
          {team.seed ? `${team.seed}. ` : ""}
          {team.name}
        </span>
      </div>
      <ManagerTag manager={team.manager} />
    </div>
  );
}

function MatchupCard({ matchup }: { matchup: Matchup }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <TeamLine
        team={matchup.top}
        isWinner={matchup.winnerId !== null && matchup.winnerId === matchup.top.id}
        isLoser={matchup.loserId !== null && matchup.loserId === matchup.top.id}
      />
      <TeamLine
        team={matchup.bottom}
        isWinner={matchup.winnerId !== null && matchup.winnerId === matchup.bottom.id}
        isLoser={matchup.loserId !== null && matchup.loserId === matchup.bottom.id}
      />
    </div>
  );
}

function ConnectorColumn({
  title,
  matchups,
}: {
  title: string;
  matchups: Matchup[];
}) {
  return (
    <div className="min-w-[220px] sm:min-w-[240px]">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h4>
      <div className="space-y-4 sm:space-y-6">
        {matchups.map((matchup, index) => (
          <div key={`${title}-${index}`} className="relative">
            <MatchupCard matchup={matchup} />
            <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-slate-300 xl:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function BracketPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: games }, { data: picks }, { data: members }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("id, school_name, seed, region")
        .order("region", { ascending: true })
        .order("seed", { ascending: true }),
      supabase
        .from("games")
        .select("id, round_name, winning_team_id, losing_team_id"),
      supabase.from("picks").select("id, member_id, team_id"),
      supabase.from("league_members").select("id, display_name"),
    ]);

  const typedTeams = (teams ?? []) as Team[];
  const typedGames = (games ?? []) as Game[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedMembers = (members ?? []) as Member[];

  const memberNameById = new Map(typedMembers.map((m) => [m.id, m.display_name]));
  const managerByTeamId = new Map(
    typedPicks.map((pick) => [pick.team_id, memberNameById.get(pick.member_id) ?? "Unknown"])
  );

  const regionBrackets = REGIONS.map((region) => {
    const teamsForRegion = typedTeams.filter((team) => team.region === region);
    return {
      region,
      ...buildRegionBracket(teamsForRegion, typedGames, managerByTeamId),
    };
  });

  const eastChampion =
    regionBrackets.find((r) => r.region === "East")?.champion ?? emptyTeam();
  const westChampion =
    regionBrackets.find((r) => r.region === "West")?.champion ?? emptyTeam();
  const southChampion =
    regionBrackets.find((r) => r.region === "South")?.champion ?? emptyTeam();
  const midwestChampion =
    regionBrackets.find((r) => r.region === "Midwest")?.champion ?? emptyTeam();

  const semifinal1 = buildFinalRoundMatchup(
    typedGames,
    "Final Four",
    eastChampion,
    westChampion
  );
  const semifinal2 = buildFinalRoundMatchup(
    typedGames,
    "Final Four",
    southChampion,
    midwestChampion
  );

  const championship = buildFinalRoundMatchup(
    typedGames,
    "Championship",
    winnerTeamFromMatchup(semifinal1),
    winnerTeamFromMatchup(semifinal2)
  );

  return (
    <div className="mx-auto max-w-[1700px] p-4 sm:p-6">
      <section className="mb-6 sm:mb-8">
        <h2 className="text-3xl font-bold">Tournament Bracket</h2>
        <p className="mt-2 text-gray-600">
          Bracket view updates automatically as results are entered by the commissioner.
        </p>
      </section>

      <div className="space-y-8 sm:space-y-10">
        {regionBrackets.map((region) => (
          <section key={region.region} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-5 text-2xl font-bold">{region.region} Region</h3>

            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-6 pb-4 sm:gap-10">
                <ConnectorColumn title="Round of 64" matchups={region.round64} />
                <ConnectorColumn title="Round of 32" matchups={region.round32} />
                <ConnectorColumn title="Sweet 16" matchups={region.sweet16} />
                <div className="min-w-[220px] sm:min-w-[240px]">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Elite Eight
                  </h4>
                  <div className="space-y-4 sm:space-y-6">
                    {region.elite8.map((matchup, index) => (
                      <MatchupCard key={`elite-${region.region}-${index}`} matchup={matchup} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}

        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h3 className="mb-5 text-2xl font-bold">Final Four & Championship</h3>

          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-6 pb-4 sm:gap-10">
              <div className="min-w-[220px] sm:min-w-[260px]">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Final Four 1
                </h4>
                <MatchupCard matchup={semifinal1} />
              </div>

              <div className="min-w-[220px] sm:min-w-[260px]">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Final Four 2
                </h4>
                <MatchupCard matchup={semifinal2} />
              </div>

              <div className="min-w-[220px] sm:min-w-[260px]">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Championship
                </h4>
                <MatchupCard matchup={championship} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}