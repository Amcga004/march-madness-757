import { createClient } from "@/lib/supabase/server";
import AutoRefreshClient from "../components/AutoRefreshClient";

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
};

type Game = {
  id: string;
  external_game_id: string | null;
  round_name: string;
  winning_team_id: string | null;
  losing_team_id: string | null;
  created_at: string;
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

type ExternalGameSync = {
  id: string;
  external_game_id: string;
  espn_event_name: string | null;
  espn_status: string | null;
  espn_period: number | null;
  espn_clock: string | null;
  start_time: string | null;
  round_name: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
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
] as const;

const MANAGER_STYLES: Record<string, string> = {
  Andrew: "bg-blue-100 text-blue-700 border-blue-200",
  Wesley: "bg-green-100 text-green-700 border-green-200",
  Eric: "bg-purple-100 text-purple-700 border-purple-200",
  Greg: "bg-orange-100 text-orange-700 border-orange-200",
};

function formatEasternDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEasternFullDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

function findExternalGameForTeams(
  externalGames: ExternalGameSync[],
  teamAId: string | null,
  teamBId: string | null
) {
  if (!teamAId || !teamBId) return null;

  return (
    externalGames.find((game) => {
      const homeId = game.mapped_home_team_id;
      const awayId = game.mapped_away_team_id;

      if (!homeId || !awayId) return false;

      return (
        (homeId === teamAId && awayId === teamBId) ||
        (homeId === teamBId && awayId === teamAId)
      );
    }) ?? null
  );
}

function getDisplayStatus(game: ExternalGameSync | null) {
  if (!game) return null;

  const status = game.espn_status ?? "";

  if (status === "STATUS_SCHEDULED") {
    if (!game.start_time) return "Scheduled";

    return formatEasternDateTime(game.start_time);
  }

  if (status === "STATUS_FINAL") {
    return "Final";
  }

  if (status.includes("HALFTIME")) {
    return "Halftime";
  }

  if (
    status === "STATUS_IN_PROGRESS" ||
    status === "STATUS_END_PERIOD" ||
    status === "STATUS_HALFTIME"
  ) {
    const clock = game.espn_clock && game.espn_clock !== "0:00" ? game.espn_clock : "";
    const period =
      game.espn_period && game.espn_period > 0 ? `${game.espn_period}H` : "";

    const pieces = [clock, period].filter(Boolean);

    return pieces.length > 0 ? `Live • ${pieces.join(" ")}` : "Live";
  }

  return status.replace("STATUS_", "").replaceAll("_", " ").trim() || null;
}

function getTeamScore(game: ExternalGameSync | null, teamId: string | null) {
  if (!game || !teamId) return null;
  if (game.mapped_home_team_id === teamId) return game.home_score;
  if (game.mapped_away_team_id === teamId) return game.away_score;
  return null;
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
  score,
  isWinner,
  isLoser,
}: {
  team: MatchupTeam;
  score: number | null;
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
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {team.seed ? `${team.seed}. ` : ""}
            {team.name}
          </span>
          <ManagerTag manager={team.manager} />
        </div>

        <div className="min-w-[24px] text-right text-sm font-bold">
          {score !== null ? score : ""}
        </div>
      </div>
    </div>
  );
}

function MatchupCard({
  matchup,
  externalGame,
}: {
  matchup: Matchup;
  externalGame: ExternalGameSync | null;
}) {
  const topScore = getTeamScore(externalGame, matchup.top.id);
  const bottomScore = getTeamScore(externalGame, matchup.bottom.id);
  const statusLabel = getDisplayStatus(externalGame);

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <TeamLine
        team={matchup.top}
        score={topScore}
        isWinner={matchup.winnerId !== null && matchup.winnerId === matchup.top.id}
        isLoser={matchup.loserId !== null && matchup.loserId === matchup.top.id}
      />

      <TeamLine
        team={matchup.bottom}
        score={bottomScore}
        isWinner={matchup.winnerId !== null && matchup.winnerId === matchup.bottom.id}
        isLoser={matchup.loserId !== null && matchup.loserId === matchup.bottom.id}
      />

      <div className="px-1 pt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {statusLabel ?? "Awaiting matchup"}
      </div>
    </div>
  );
}

function ConnectorColumn({
  title,
  matchups,
  externalGames,
}: {
  title: string;
  matchups: Matchup[];
  externalGames: ExternalGameSync[];
}) {
  return (
    <div className="min-w-[240px] sm:min-w-[260px]">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h4>

      <div className="space-y-4 sm:space-y-6">
        {matchups.map((matchup, index) => {
          const externalGame = findExternalGameForTeams(
            externalGames,
            matchup.top.id,
            matchup.bottom.id
          );

          return (
            <div key={`${title}-${index}`} className="relative">
              <MatchupCard matchup={matchup} externalGame={externalGame} />
              <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-slate-300 xl:block" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function BracketPage() {
  const supabase = await createClient();

  const [
    { data: teams },
    { data: games },
    { data: picks },
    { data: members },
    { data: externalGames },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, school_name, seed, region")
      .order("region", { ascending: true })
      .order("seed", { ascending: true }),
    supabase
      .from("games")
      .select("id, external_game_id, round_name, winning_team_id, losing_team_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("picks").select("id, member_id, team_id"),
    supabase.from("league_members").select("id, display_name"),
    supabase
      .from("external_game_sync")
      .select(
        "id, external_game_id, espn_event_name, espn_status, espn_period, espn_clock, start_time, round_name, home_team_name, away_team_name, home_score, away_score, mapped_home_team_id, mapped_away_team_id"
      )
      .order("start_time", { ascending: true }),
  ]);

  const typedTeams = (teams ?? []) as Team[];
  const typedGames = (games ?? []) as Game[];
  const typedPicks = (picks ?? []) as Pick[];
  const typedMembers = (members ?? []) as Member[];
  const typedExternalGames = (externalGames ?? []) as ExternalGameSync[];

  const latestOfficialUpdate = typedGames[0]?.created_at ?? null;

  const now = Date.now();

  const nextScheduledGame =
    typedExternalGames
      .map((game) => game.start_time)
      .filter((value): value is string => !!value)
      .filter((value) => new Date(value).getTime() >= now)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;

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

  const finalFourExternalGames = typedExternalGames;

  return (
    <div className="mx-auto max-w-[1700px] p-4 sm:p-6">
      <AutoRefreshClient intervalMs={60000} />

      <section className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Tournament Bracket</h2>
            <p className="mt-2 text-gray-600">
              Live bracket view with scheduled tip times, in-game scores, and automatic advancement once results are promoted.
            </p>
          </div>

          <div className="space-y-1 text-sm text-slate-500 sm:text-right">
            <div>
              {latestOfficialUpdate
                ? `Last official result: ${formatEasternFullDateTime(latestOfficialUpdate)}`
                : "No official results entered yet"}
            </div>
            <div>
              {nextScheduledGame
                ? `Next scheduled game: ${formatEasternFullDateTime(nextScheduledGame)}`
                : "No upcoming scheduled games in feed window"}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-8 sm:space-y-10">
        {regionBrackets.map((region) => (
          <section key={region.region} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-5 text-2xl font-bold">{region.region} Region</h3>

            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-6 pb-4 sm:gap-10">
                <ConnectorColumn
                  title="Round of 64"
                  matchups={region.round64}
                  externalGames={typedExternalGames}
                />
                <ConnectorColumn
                  title="Round of 32"
                  matchups={region.round32}
                  externalGames={typedExternalGames}
                />
                <ConnectorColumn
                  title="Sweet 16"
                  matchups={region.sweet16}
                  externalGames={typedExternalGames}
                />
                <div className="min-w-[240px] sm:min-w-[260px]">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Elite Eight
                  </h4>

                  <div className="space-y-4 sm:space-y-6">
                    {region.elite8.map((matchup, index) => {
                      const externalGame = findExternalGameForTeams(
                        typedExternalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return (
                        <MatchupCard
                          key={`elite-${region.region}-${index}`}
                          matchup={matchup}
                          externalGame={externalGame}
                        />
                      );
                    })}
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
              <div className="min-w-[240px] sm:min-w-[260px]">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Final Four 1
                </h4>
                <MatchupCard
                  matchup={semifinal1}
                  externalGame={findExternalGameForTeams(
                    finalFourExternalGames,
                    semifinal1.top.id,
                    semifinal1.bottom.id
                  )}
                />
              </div>

              <div className="min-w-[240px] sm:min-w-[260px]">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Final Four 2
                </h4>
                <MatchupCard
                  matchup={semifinal2}
                  externalGame={findExternalGameForTeams(
                    finalFourExternalGames,
                    semifinal2.top.id,
                    semifinal2.bottom.id
                  )}
                />
              </div>

              <div className="min-w-[240px] sm:min-w-[260px]">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Championship
                </h4>
                <MatchupCard
                  matchup={championship}
                  externalGame={findExternalGameForTeams(
                    finalFourExternalGames,
                    championship.top.id,
                    championship.bottom.id
                  )}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}