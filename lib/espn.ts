export type EspnCompetitionCompetitor = {
  id: string;
  homeAway: "home" | "away";
  winner?: boolean;
  score?: string;
  team: {
    id: string;
    displayName: string;
    shortDisplayName?: string;
    abbreviation?: string;
  };
};

export type EspnEvent = {
  id: string;
  name: string;
  date: string;
  status?: {
    type?: {
      name?: string;
      state?: string;
      completed?: boolean;
      description?: string;
      shortDetail?: string;
      detail?: string;
    };
    period?: number;
    displayClock?: string;
  };
  competitions?: Array<{
    competitors: EspnCompetitionCompetitor[];
    status?: {
      type?: {
        name?: string;
        state?: string;
        completed?: boolean;
        description?: string;
        shortDetail?: string;
        detail?: string;
      };
    };
  }>;
};

export type EspnScoreboardResponse = {
  events?: EspnEvent[];
};

export type NormalizedEspnGame = {
  provider: "espn";
  external_game_id: string;
  espn_event_name: string;
  espn_status: string | null;
  espn_period: number | null;
  espn_clock: string | null;
  start_time: string | null;
  home_team_external_id: string | null;
  away_team_external_id: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  raw_payload: EspnEvent;
};

function parseScore(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getPreferredTeamName(
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
  } | null
): string | null {
  if (!team) return null;

  return (
    team.shortDisplayName?.trim() ||
    team.displayName?.trim() ||
    team.abbreviation?.trim() ||
    null
  );
}

export function normalizeTeamName(name?: string | null): string | null {
  if (!name) return null;

  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/\./g, "")
    .replace(/-/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\buniversity\b/g, "")
    .replace(/\bcollege\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getEspnScoreboardUrl(date: string) {
  return `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}`;
}

export async function fetchEspnScoreboard(
  date: string
): Promise<EspnScoreboardResponse> {
  const url = getEspnScoreboardUrl(date);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN scoreboard fetch failed with status ${response.status}`);
  }

  return (await response.json()) as EspnScoreboardResponse;
}

export function normalizeEspnEvent(event: EspnEvent): NormalizedEspnGame | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];

  const home = competitors.find((team) => team.homeAway === "home") ?? null;
  const away = competitors.find((team) => team.homeAway === "away") ?? null;

  if (!home || !away) {
    return null;
  }

  const statusType = event.status?.type ?? competition?.status?.type ?? null;

  const homeName = getPreferredTeamName(home.team);
  const awayName = getPreferredTeamName(away.team);

  return {
    provider: "espn",
    external_game_id: event.id,
    espn_event_name: event.name,
    espn_status: statusType?.name ?? statusType?.description ?? null,
    espn_period: event.status?.period ?? null,
    espn_clock: event.status?.displayClock ?? null,
    start_time: event.date ?? null,
    home_team_external_id: home.team?.id ?? null,
    away_team_external_id: away.team?.id ?? null,
    home_team_name: normalizeTeamName(homeName),
    away_team_name: normalizeTeamName(awayName),
    home_score: parseScore(home.score),
    away_score: parseScore(away.score),
    raw_payload: event,
  };
}