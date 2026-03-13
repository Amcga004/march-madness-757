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

type MatchupTeam = {
  id: string | null;
  name: string;
  seed: number | null;
};

type Matchup = {
  top: MatchupTeam;
  bottom: MatchupTeam;
  winnerId: string | null;
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

function emptyTeam(): MatchupTeam {
  return {
    id: null,
    name: "TBD",
    seed: null,
  };
}

function buildTeam(team?: Team): MatchupTeam {
  if (!team) return emptyTeam();

  return {
    id: team.id,
    name: team.school_name,
    seed: team.seed,
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

function winnerFromGame(game: Game | null, teamAId: string | null, teamBId: string | null) {
  if (!game) return null;
  if (game.winning_team_id === teamAId) return teamAId;
  if (game.winning_team_id === teamBId) return teamBId;
  return null;
}

function winnerTeamFromMatchup(matchup: Matchup): MatchupTeam {
  if (matchup.winnerId === matchup.top.id) return matchup.top;
  if (matchup.winnerId === matchup.bottom.id) return matchup.bottom;
  return emptyTeam();
}

function buildRegionBracket(regionTeams: Team[], games: Game[]) {
  const seedMap = new Map(regionTeams.map((team) => [team.seed, team]));

  const round64: Matchup[] = ROUND_OF_64_PAIRS.map(([seedA, seedB]) => {
    const top = buildTeam(seedMap.get(seedA));
    const bottom = buildTeam(seedMap.get(seedB));
    const game = findGameForTeams(games, "Round of 64", top.id, bottom.id);

    return {
      top,
      bottom,
      winnerId: winnerFromGame(game, top.id, bottom.id),
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
  };
}

function TeamLine({
  team,
  isWinner,
}: {
  team: MatchupTeam;
  isWinner: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
        isWinner ? "bg-green-50 font-semibold" : "bg-white"
      }`}
    >
      <span className="truncate">
        {team.seed ? `${team.seed}. ` : ""}
        {team.name}
      </span>
    </div>
  );
}

function MatchupCard({ matchup }: { matchup: Matchup }) {
  return (
    <div className="space-y-2 rounded-xl border bg-slate-50 p-3">
      <TeamLine
        team={matchup.top}
        isWinner={matchup.winnerId !== null && matchup.winnerId === matchup.top.id}
      />
      <TeamLine
        team={matchup.bottom}
        isWinner={matchup.winnerId !== null && matchup.winnerId === matchup.bottom.id}
      />
    </div>
  );
}

function RoundColumn({
  title,
  matchups,
}: {
  title: string;
  matchups: Matchup[];
}) {
  return (
    <div className="min-w-[220px]">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h4>
      <div className="space-y-4">
        {matchups.map((matchup, index) => (
          <MatchupCard key={`${title}-${index}`} matchup={matchup} />
        ))}
      </div>
    </div>
  );
}

export default async function BracketPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: games }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, school_name, seed, region")
      .order("region", { ascending: true })
      .order("seed", { ascending: true }),
    supabase
      .from("games")
      .select("id, round_name, winning_team_id, losing_team_id"),
  ]);

  const typedTeams = (teams ?? []) as Team[];
  const typedGames = (games ?? []) as Game[];

  const regionBrackets = REGIONS.map((region) => {
    const teamsForRegion = typedTeams.filter((team) => team.region === region);
    return {
      region,
      ...buildRegionBracket(teamsForRegion, typedGames),
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
    <div className="mx-auto max-w-[1600px] p-6">
      <section className="mb-8">
        <h2 className="text-3xl font-bold">Tournament Bracket</h2>
        <p className="mt-2 text-gray-600">
          Bracket view updates automatically as results are entered by the commissioner.
        </p>
      </section>

      <div className="space-y-10">
        {regionBrackets.map((region) => (
          <section key={region.region} className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="mb-6 text-2xl font-bold">{region.region} Region</h3>

            <div className="overflow-x-auto">
              <div className="flex gap-6 pb-2">
                <RoundColumn title="Round of 64" matchups={region.round64} />
                <RoundColumn title="Round of 32" matchups={region.round32} />
                <RoundColumn title="Sweet 16" matchups={region.sweet16} />
                <RoundColumn title="Elite Eight" matchups={region.elite8} />
              </div>
            </div>
          </section>
        ))}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="mb-6 text-2xl font-bold">Final Four & Championship</h3>

          <div className="grid gap-6 xl:grid-cols-3">
            <div>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Final Four 1
              </h4>
              <MatchupCard matchup={semifinal1} />
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Final Four 2
              </h4>
              <MatchupCard matchup={semifinal2} />
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Championship
              </h4>
              <MatchupCard matchup={championship} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}