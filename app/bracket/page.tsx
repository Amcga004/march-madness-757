import { createClient } from "@/lib/supabase/server";
import AutoRefreshClient from "../components/AutoRefreshClient";

type Team = {
  id: string;
  school_name: string;
  seed: number;
  region: string;
  is_play_in_actual?: boolean;
  is_play_in_placeholder?: boolean;
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

const MANAGER_ROW_STYLES: Record<string, string> = {
  Andrew:
    "border-l-4 border-l-blue-400 bg-blue-500/8 shadow-[inset_3px_0_0_rgba(96,165,250,0.55)]",
  Wesley:
    "border-l-4 border-l-green-400 bg-green-500/8 shadow-[inset_3px_0_0_rgba(74,222,128,0.5)]",
  Eric:
    "border-l-4 border-l-purple-400 bg-purple-500/8 shadow-[inset_3px_0_0_rgba(192,132,252,0.5)]",
  Greg:
    "border-l-4 border-l-orange-400 bg-orange-500/8 shadow-[inset_3px_0_0_rgba(251,146,60,0.5)]",
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

function normalizeTeamName(value: string | null | undefined) {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.'’]/g, "")
    .replace(/[()]/g, " ")
    .replace(/\//g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRegionAnchor(region: string | null | undefined) {
  if (!region) return null;
  return `${region.toLowerCase()}-region`;
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

function buildExternalMatchupTeam(
  teamId: string | null,
  fallbackName: string | null,
  teamById: Map<string, Team>,
  managerByTeamId: Map<string, string>
): MatchupTeam {
  if (teamId) {
    const team = teamById.get(teamId);
    if (team) {
      return {
        id: team.id,
        name: team.school_name,
        seed: team.seed,
        manager: managerByTeamId.get(team.id) ?? null,
      };
    }
  }

  return {
    id: teamId,
    name: fallbackName ?? "TBD",
    seed: null,
    manager: teamId ? managerByTeamId.get(teamId) ?? null : null,
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

function isLiveGame(game: ExternalGameSync | null) {
  if (!game) return false;

  return (
    game.espn_status === "STATUS_IN_PROGRESS" ||
    game.espn_status === "STATUS_END_PERIOD" ||
    game.espn_status === "STATUS_HALFTIME" ||
    (game.espn_status ?? "").includes("HALFTIME")
  );
}

function isFinalGame(game: ExternalGameSync | null) {
  return game?.espn_status === "STATUS_FINAL";
}

function getCardClasses(game: ExternalGameSync | null) {
  if (isLiveGame(game)) {
    return "border-red-500/70 bg-[#1a1220] shadow-[0_0_0_1px_rgba(239,68,68,0.18),0_0_20px_rgba(239,68,68,0.14)]";
  }

  if (isFinalGame(game)) {
    return "border-slate-700/80 bg-[#111827]";
  }

  return "border-slate-700/80 bg-[#111827]";
}

function getStatusClasses(game: ExternalGameSync | null) {
  if (isLiveGame(game)) {
    return "text-red-300";
  }

  return "text-slate-400";
}

function getTeamScore(game: ExternalGameSync | null, teamId: string | null) {
  if (!game || !teamId) return null;
  if (game.mapped_home_team_id === teamId) return game.home_score;
  if (game.mapped_away_team_id === teamId) return game.away_score;
  return null;
}

function getTeamScoreBySide(
  game: ExternalGameSync | null,
  side: "home" | "away",
  teamId: string | null
) {
  if (!game) return null;

  if (teamId) {
    return getTeamScore(game, teamId);
  }

  return side === "home" ? game.home_score : game.away_score;
}

function inferWinnerIdFromExternalGame(game: ExternalGameSync | null) {
  if (!game || game.espn_status !== "STATUS_FINAL") return null;

  if (
    game.home_score !== null &&
    game.away_score !== null &&
    game.mapped_home_team_id &&
    game.mapped_away_team_id
  ) {
    if (game.home_score > game.away_score) return game.mapped_home_team_id;
    if (game.away_score > game.home_score) return game.mapped_away_team_id;
  }

  return null;
}

function inferLoserIdFromExternalGame(game: ExternalGameSync | null) {
  if (!game || game.espn_status !== "STATUS_FINAL") return null;

  if (
    game.home_score !== null &&
    game.away_score !== null &&
    game.mapped_home_team_id &&
    game.mapped_away_team_id
  ) {
    if (game.home_score > game.away_score) return game.mapped_away_team_id;
    if (game.away_score > game.home_score) return game.mapped_home_team_id;
  }

  return null;
}

function isPlayInExternalGame(game: ExternalGameSync, playInTeamIds: Set<string>) {
  const roundName = (game.round_name ?? "").toLowerCase();
  const eventName = (game.espn_event_name ?? "").toLowerCase();

  if (
    roundName.includes("first four") ||
    roundName.includes("play-in") ||
    eventName.includes("first four") ||
    eventName.includes("play-in")
  ) {
    return true;
  }

  const homeIsPlayIn =
    !!game.mapped_home_team_id && playInTeamIds.has(game.mapped_home_team_id);
  const awayIsPlayIn =
    !!game.mapped_away_team_id && playInTeamIds.has(game.mapped_away_team_id);

  return homeIsPlayIn && awayIsPlayIn;
}

function getPlayInParticipantsFromPlaceholder(placeholderName: string) {
  if (!placeholderName.startsWith("PLAY-IN:")) return [];

  const raw = placeholderName.replace("PLAY-IN:", "").trim();
  return raw
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizeTeamName(value));
}

function resolvePlayInWinnerForPlaceholder(
  placeholderTeam: Team | undefined,
  externalGames: ExternalGameSync[],
  teamById: Map<string, Team>
): Team | undefined {
  if (!placeholderTeam || !placeholderTeam.is_play_in_placeholder) return placeholderTeam;

  const participantNames = getPlayInParticipantsFromPlaceholder(placeholderTeam.school_name);
  if (participantNames.length !== 2) return placeholderTeam;

  const matchingExternalGame =
    externalGames.find((game) => {
      const homeNormalized = normalizeTeamName(game.home_team_name);
      const awayNormalized = normalizeTeamName(game.away_team_name);

      return (
        participantNames.includes(homeNormalized) &&
        participantNames.includes(awayNormalized)
      );
    }) ?? null;

  if (!matchingExternalGame) return placeholderTeam;

  const winnerId = inferWinnerIdFromExternalGame(matchingExternalGame);
  if (!winnerId) return placeholderTeam;

  return teamById.get(winnerId) ?? placeholderTeam;
}

function buildRegionBracket(
  regionTeams: Team[],
  games: Game[],
  externalGames: ExternalGameSync[],
  managerByTeamId: Map<string, string>,
  teamById: Map<string, Team>
) {
  const baseSeedMap = new Map(regionTeams.map((team) => [team.seed, team]));

  const seedMap = new Map<number, Team>();
  for (const [seed, team] of baseSeedMap.entries()) {
    const resolvedTeam = resolvePlayInWinnerForPlaceholder(team, externalGames, teamById);
    seedMap.set(seed, resolvedTeam ?? team);
  }

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

function getLiveGameHref(
  game: ExternalGameSync,
  teamById: Map<string, Team>,
  playInTeamIds: Set<string>
) {
  if (isPlayInExternalGame(game, playInTeamIds)) {
    return "#active-playin";
  }

  const roundName = game.round_name ?? "";
  if (roundName === "Final Four" || roundName === "Championship") {
    return "#finals-section";
  }

  const homeRegion = game.mapped_home_team_id
    ? teamById.get(game.mapped_home_team_id)?.region ?? null
    : null;
  const awayRegion = game.mapped_away_team_id
    ? teamById.get(game.mapped_away_team_id)?.region ?? null
    : null;

  return `#${getRegionAnchor(homeRegion ?? awayRegion) ?? "finals-section"}`;
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

function getOwnedRowClasses(manager: string | null) {
  if (!manager) return "";
  return MANAGER_ROW_STYLES[manager] ?? "";
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
  const ownedClasses = !isWinner && !isLoser ? getOwnedRowClasses(team.manager) : "";
  const winnerClasses = isWinner
    ? "border-green-500/60 bg-green-500/10 text-green-200"
    : "";
  const loserClasses = isLoser
    ? "border-red-500/60 bg-red-500/10 text-red-200 line-through"
    : "";
  const baseClasses =
    !isWinner && !isLoser ? "border-slate-700/80 bg-[#172033] text-white" : "";

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 transition sm:px-3 sm:py-2 ${winnerClasses} ${loserClasses} ${baseClasses} ${ownedClasses}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-[13px] font-medium sm:text-sm">
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
    <div className={`space-y-2 rounded-xl border p-2.5 shadow-sm transition sm:p-3 ${getCardClasses(externalGame)}`}>
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

      <div className={`px-1 pt-1 text-xs font-medium uppercase tracking-wide ${getStatusClasses(externalGame)}`}>
        {statusLabel ?? "Awaiting matchup"}
      </div>
    </div>
  );
}

function ExternalMatchupCard({
  externalGame,
  teamById,
  managerByTeamId,
}: {
  externalGame: ExternalGameSync;
  teamById: Map<string, Team>;
  managerByTeamId: Map<string, string>;
}) {
  const top = buildExternalMatchupTeam(
    externalGame.mapped_home_team_id,
    externalGame.home_team_name,
    teamById,
    managerByTeamId
  );
  const bottom = buildExternalMatchupTeam(
    externalGame.mapped_away_team_id,
    externalGame.away_team_name,
    teamById,
    managerByTeamId
  );

  const inferredWinnerId = inferWinnerIdFromExternalGame(externalGame);
  const inferredLoserId = inferLoserIdFromExternalGame(externalGame);
  const statusLabel = getDisplayStatus(externalGame);

  return (
    <div className={`space-y-2 rounded-xl border p-2.5 shadow-sm transition sm:p-3 ${getCardClasses(externalGame)}`}>
      <TeamLine
        team={top}
        score={getTeamScoreBySide(externalGame, "home", top.id)}
        isWinner={inferredWinnerId !== null && inferredWinnerId === top.id}
        isLoser={inferredLoserId !== null && inferredLoserId === top.id}
      />

      <TeamLine
        team={bottom}
        score={getTeamScoreBySide(externalGame, "away", bottom.id)}
        isWinner={inferredWinnerId !== null && inferredWinnerId === bottom.id}
        isLoser={inferredLoserId !== null && inferredLoserId === bottom.id}
      />

      <div className={`px-1 pt-1 text-xs font-medium uppercase tracking-wide ${getStatusClasses(externalGame)}`}>
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
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h4>

      <div className="space-y-3 sm:space-y-5">
        {matchups.map((matchup, index) => {
          const externalGame = findExternalGameForTeams(
            externalGames,
            matchup.top.id,
            matchup.bottom.id
          );

          return (
            <div key={`${title}-${index}`} className="relative">
              <MatchupCard matchup={matchup} externalGame={externalGame} />
              <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-slate-700 xl:block" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileCollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <details
      id={id}
      className="group rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>

        <div className="shrink-0 text-slate-300 transition-transform duration-200 group-open:rotate-180">
          ▼
        </div>
      </summary>

      <div className="mt-4">{children}</div>
    </details>
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
      .select("id, school_name, seed, region, is_play_in_actual, is_play_in_placeholder")
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
  const teamById = new Map(typedTeams.map((team) => [team.id, team]));

  const playInTeamIds = new Set(
    typedTeams.filter((team) => team.is_play_in_actual).map((team) => team.id)
  );

  const playInGames = typedExternalGames.filter((game) =>
    isPlayInExternalGame(game, playInTeamIds)
  );

  const allPlayInGamesComplete =
    playInGames.length >= 4 && playInGames.every((game) => isFinalGame(game));

  const activePlayInGames = allPlayInGamesComplete ? [] : playInGames;
  const archivedPlayInGames = allPlayInGamesComplete ? playInGames : [];

  const liveGames = typedExternalGames.filter(
    (game) => isLiveGame(game) && !isPlayInExternalGame(game, playInTeamIds)
  );

  const regionBrackets = REGIONS.map((region) => {
    const teamsForRegion = typedTeams.filter(
      (team) => team.region === region && !team.is_play_in_actual
    );

    return {
      region,
      ...buildRegionBracket(
        teamsForRegion,
        typedGames,
        playInGames,
        managerByTeamId,
        teamById
      ),
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
    <div className="mx-auto max-w-[1700px] p-3 sm:p-6">
      <AutoRefreshClient intervalMs={15000} hiddenIntervalMs={60000} />

      <section className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">Tournament Bracket</h2>
            <p className="mt-2 text-slate-300">
              Live bracket view with scheduled tip times, in-game scores, and automatic advancement once results are promoted.
            </p>
          </div>

          <div className="space-y-1 text-sm text-slate-400 sm:text-right">
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

      <div className="space-y-6 sm:space-y-8">
        {liveGames.length > 0 ? (
          <section className="rounded-3xl border border-red-500/40 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5">
            <div className="mb-5">
              <h3 className="text-2xl font-bold text-white">Live Games Right Now</h3>
              <p className="mt-1 text-sm text-slate-300">
                Active tournament games pulled to the top for quick tracking. Tap a live game to jump to its bracket section.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {liveGames.map((game) => {
                const href = getLiveGameHref(game, teamById, playInTeamIds);

                return (
                  <a
                    key={game.id}
                    href={href}
                    className="group min-w-0 rounded-xl transition hover:-translate-y-0.5 hover:opacity-95"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-red-300">
                        {game.round_name ?? "Live"}
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 group-hover:text-white">
                        Jump ↓
                      </div>
                    </div>

                    <ExternalMatchupCard
                      externalGame={game}
                      teamById={teamById}
                      managerByTeamId={managerByTeamId}
                    />
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}

        {activePlayInGames.length > 0 ? (
          <>
            <div className="lg:hidden">
              <MobileCollapsibleSection
                id="active-playin"
                title="First Four / Play-In Games"
                subtitle="Tap to collapse or expand this section."
                defaultOpen={true}
              >
                <div className="grid grid-cols-1 gap-4">
                  {activePlayInGames.map((game) => (
                    <div key={game.id} className="min-w-0">
                      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {game.round_name ?? "Play-In"}
                      </div>
                      <ExternalMatchupCard
                        externalGame={game}
                        teamById={teamById}
                        managerByTeamId={managerByTeamId}
                      />
                    </div>
                  ))}
                </div>
              </MobileCollapsibleSection>
            </div>

            <section
              id="active-playin"
              className="hidden rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5 lg:block"
            >
              <div className="mb-5">
                <h3 className="text-2xl font-bold text-white">First Four / Play-In Games</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Live and final play-in matchups from the ESPN sync feed.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {activePlayInGames.map((game) => (
                  <div key={game.id} className="min-w-0">
                    <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {game.round_name ?? "Play-In"}
                    </div>
                    <ExternalMatchupCard
                      externalGame={game}
                      teamById={teamById}
                      managerByTeamId={managerByTeamId}
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <div className="space-y-4 lg:hidden">
          {regionBrackets.map((region, index) => (
            <MobileCollapsibleSection
              key={region.region}
              id={getRegionAnchor(region.region) ?? undefined}
              title={`${region.region} Region`}
              subtitle="Tap to collapse or expand this region."
              defaultOpen={index === 0}
            >
              <div className="space-y-5">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Round of 64
                  </h4>
                  <div className="space-y-3">
                    {region.round64.map((matchup, matchupIndex) => {
                      const externalGame = findExternalGameForTeams(
                        typedExternalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return (
                        <MatchupCard
                          key={`${region.region}-r64-${matchupIndex}`}
                          matchup={matchup}
                          externalGame={externalGame}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Round of 32
                  </h4>
                  <div className="space-y-3">
                    {region.round32.map((matchup, matchupIndex) => {
                      const externalGame = findExternalGameForTeams(
                        typedExternalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return (
                        <MatchupCard
                          key={`${region.region}-r32-${matchupIndex}`}
                          matchup={matchup}
                          externalGame={externalGame}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Sweet 16
                  </h4>
                  <div className="space-y-3">
                    {region.sweet16.map((matchup, matchupIndex) => {
                      const externalGame = findExternalGameForTeams(
                        typedExternalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return (
                        <MatchupCard
                          key={`${region.region}-s16-${matchupIndex}`}
                          matchup={matchup}
                          externalGame={externalGame}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Elite Eight
                  </h4>
                  <div className="space-y-3">
                    {region.elite8.map((matchup, matchupIndex) => {
                      const externalGame = findExternalGameForTeams(
                        typedExternalGames,
                        matchup.top.id,
                        matchup.bottom.id
                      );

                      return (
                        <MatchupCard
                          key={`${region.region}-e8-${matchupIndex}`}
                          matchup={matchup}
                          externalGame={externalGame}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </MobileCollapsibleSection>
          ))}
        </div>

        <div className="hidden space-y-6 sm:space-y-8 lg:block">
          {regionBrackets.map((region) => (
            <section
              key={region.region}
              id={getRegionAnchor(region.region) ?? undefined}
              className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5"
            >
              <h3 className="mb-5 text-2xl font-bold text-white">{region.region} Region</h3>

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
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                      Elite Eight
                    </h4>

                    <div className="space-y-3 sm:space-y-5">
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
        </div>

        <section
          id="finals-section"
          className="rounded-3xl border border-slate-700/80 bg-[#111827]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:p-5"
        >
          <h3 className="mb-5 text-2xl font-bold text-white">Final Four & Championship</h3>

          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-6 pb-4 sm:gap-10">
              <div className="min-w-[240px] sm:min-w-[260px]">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
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
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
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
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
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

        {archivedPlayInGames.length > 0 ? (
          <details className="rounded-3xl border border-slate-700/80 bg-[#0b1220]/90 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)] sm:p-5">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Archived First Four / Play-In Games
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Completed play-in games moved out of the main view once all four are final.
                  </p>
                </div>

                <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Show
                </div>
              </div>
            </summary>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {archivedPlayInGames.map((game) => (
                <div key={game.id} className="min-w-0">
                  <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {game.round_name ?? "Play-In"}
                  </div>
                  <ExternalMatchupCard
                    externalGame={game}
                    teamById={teamById}
                    managerByTeamId={managerByTeamId}
                  />
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}