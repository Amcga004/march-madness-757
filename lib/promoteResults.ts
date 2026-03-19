import { createClient } from "@/lib/supabase/server";

type ExternalGameSyncRow = {
  id: string;
  external_game_id: string;
  espn_event_name: string | null;
  espn_status: string | null;
  round_name: string | null;
  home_score: number | null;
  away_score: number | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
  promoted_to_results: boolean | null;
};

type TeamRow = {
  id: string;
  school_name: string;
  is_play_in_actual: boolean | null;
  is_play_in_placeholder: boolean | null;
};

type GameRow = {
  id: string;
  external_game_id: string | null;
  round_name: string;
};

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

function getPlayInParticipantsFromPlaceholder(placeholderName: string) {
  const normalizedLabel = placeholderName
    .replace(/^play[\s-]?in:/i, "")
    .trim();

  return normalizedLabel
    .split("/")
    .map((value) => normalizeTeamName(value))
    .filter(Boolean);
}

function isPlayInGame(
  game: ExternalGameSyncRow,
  playInActualTeamIds: Set<string>
) {
  const roundName = (game.round_name ?? "").toLowerCase();
  const eventName = (game.espn_event_name ?? "").toLowerCase();

  if (
    roundName.includes("first four") ||
    roundName.includes("play-in") ||
    roundName.includes("play in") ||
    eventName.includes("first four") ||
    eventName.includes("play-in") ||
    eventName.includes("play in")
  ) {
    return true;
  }

  const homeIsPlayIn =
    !!game.mapped_home_team_id && playInActualTeamIds.has(game.mapped_home_team_id);
  const awayIsPlayIn =
    !!game.mapped_away_team_id && playInActualTeamIds.has(game.mapped_away_team_id);

  return homeIsPlayIn && awayIsPlayIn;
}

function getNormalizedOfficialRoundName(
  game: ExternalGameSyncRow,
  playInActualTeamIds: Set<string>
) {
  if (isPlayInGame(game, playInActualTeamIds)) {
    return "First Four";
  }

  return game.round_name?.trim() || "Round of 64";
}

function getWinnerAndLoser(game: ExternalGameSyncRow) {
  if (
    !game.mapped_home_team_id ||
    !game.mapped_away_team_id ||
    game.home_score == null ||
    game.away_score == null
  ) {
    return null;
  }

  if (game.home_score > game.away_score) {
    return {
      winningTeamId: game.mapped_home_team_id,
      losingTeamId: game.mapped_away_team_id,
    };
  }

  if (game.away_score > game.home_score) {
    return {
      winningTeamId: game.mapped_away_team_id,
      losingTeamId: game.mapped_home_team_id,
    };
  }

  return null;
}

function findMatchingPlaceholderTeam(
  teams: TeamRow[],
  actualHomeTeamId: string,
  actualAwayTeamId: string
) {
  const actualTeamIds = new Set([actualHomeTeamId, actualAwayTeamId]);

  const actualTeams = teams.filter((team) => actualTeamIds.has(team.id));
  if (actualTeams.length !== 2) return null;

  const actualNames = actualTeams.map((team) => normalizeTeamName(team.school_name));

  return (
    teams.find((team) => {
      if (!team.is_play_in_placeholder) return false;

      const participants = getPlayInParticipantsFromPlaceholder(team.school_name);
      if (participants.length !== 2) return false;

      return actualNames.every((name) => participants.includes(name));
    }) ?? null
  );
}

async function upsertOfficialGame(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existingGameByExternalId: Map<string, GameRow>,
  externalGame: ExternalGameSyncRow,
  winningTeamId: string,
  losingTeamId: string,
  normalizedRoundName: string
) {
  const existingGame = existingGameByExternalId.get(externalGame.external_game_id);

  if (existingGame) {
    const { error } = await supabase
      .from("games")
      .update({
        winning_team_id: winningTeamId,
        losing_team_id: losingTeamId,
        status: "FINAL",
        round_name: normalizedRoundName,
      })
      .eq("id", existingGame.id);

    if (error) throw new Error(error.message);

    existingGameByExternalId.set(externalGame.external_game_id, {
      ...existingGame,
      round_name: normalizedRoundName,
    });

    return;
  }

  const { data: insertedRows, error } = await supabase
    .from("games")
    .insert({
      external_game_id: externalGame.external_game_id,
      winning_team_id: winningTeamId,
      losing_team_id: losingTeamId,
      status: "FINAL",
      round_name: normalizedRoundName,
    })
    .select("id, external_game_id, round_name")
    .limit(1);

  if (error) throw new Error(error.message);

  const inserted = insertedRows?.[0];
  if (inserted?.external_game_id) {
    existingGameByExternalId.set(inserted.external_game_id, inserted as GameRow);
  }
}

async function migratePlayInPlaceholderPickIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teams: TeamRow[],
  externalGame: ExternalGameSyncRow,
  winningTeamId: string
) {
  if (!externalGame.mapped_home_team_id || !externalGame.mapped_away_team_id) {
    return false;
  }

  const placeholderTeam = findMatchingPlaceholderTeam(
    teams,
    externalGame.mapped_home_team_id,
    externalGame.mapped_away_team_id
  );

  if (!placeholderTeam) return false;

  const { data: picksToUpdate, error: picksError } = await supabase
    .from("picks")
    .select("id, team_id")
    .eq("team_id", placeholderTeam.id);

  if (picksError) throw new Error(picksError.message);

  if (!picksToUpdate || picksToUpdate.length === 0) {
    return false;
  }

  const { error: updateError } = await supabase
    .from("picks")
    .update({ team_id: winningTeamId })
    .eq("team_id", placeholderTeam.id);

  if (updateError) throw new Error(updateError.message);

  return true;
}

export async function promoteResults() {
  const supabase = await createClient();

  const [
    { data: finalExternalGames, error: externalGamesError },
    { data: teams, error: teamsError },
    { data: existingGames, error: existingGamesError },
  ] = await Promise.all([
    supabase
      .from("external_game_sync")
      .select(
        "id, external_game_id, espn_event_name, espn_status, round_name, home_score, away_score, mapped_home_team_id, mapped_away_team_id, promoted_to_results"
      )
      .eq("espn_status", "STATUS_FINAL"),
    supabase
      .from("teams")
      .select("id, school_name, is_play_in_actual, is_play_in_placeholder"),
    supabase
      .from("games")
      .select("id, external_game_id, round_name"),
  ]);

  if (externalGamesError) throw new Error(externalGamesError.message);
  if (teamsError) throw new Error(teamsError.message);
  if (existingGamesError) throw new Error(existingGamesError.message);

  const typedExternalGames = (finalExternalGames ?? []) as ExternalGameSyncRow[];
  const typedTeams = (teams ?? []) as TeamRow[];
  const typedExistingGames = (existingGames ?? []) as GameRow[];

  const existingGameByExternalId = new Map<string, GameRow>(
    typedExistingGames
      .filter((game) => !!game.external_game_id)
      .map((game) => [game.external_game_id as string, game])
  );

  const playInActualTeamIds = new Set(
    typedTeams
      .filter((team) => team.is_play_in_actual)
      .map((team) => team.id)
  );

  let promoted = 0;
  let correctedRounds = 0;
  let migratedPlaceholderPicks = 0;

  for (const game of typedExternalGames) {
    const outcome = getWinnerAndLoser(game);
    if (!outcome) continue;

    const normalizedRoundName = getNormalizedOfficialRoundName(game, playInActualTeamIds);

    const existingOfficialGame = existingGameByExternalId.get(game.external_game_id);
    const existingRoundName = existingOfficialGame?.round_name ?? null;

    await upsertOfficialGame(
      supabase,
      existingGameByExternalId,
      game,
      outcome.winningTeamId,
      outcome.losingTeamId,
      normalizedRoundName
    );

    if (existingOfficialGame && existingRoundName !== normalizedRoundName) {
      correctedRounds += 1;
    }

    if (isPlayInGame(game, playInActualTeamIds)) {
      const migrated = await migratePlayInPlaceholderPickIfNeeded(
        supabase,
        typedTeams,
        game,
        outcome.winningTeamId
      );

      if (migrated) {
        migratedPlaceholderPicks += 1;
      }
    }

    if (!game.promoted_to_results) {
      const { error: updateError } = await supabase
        .from("external_game_sync")
        .update({ promoted_to_results: true })
        .eq("id", game.id);

      if (updateError) throw new Error(updateError.message);

      promoted += 1;
    }
  }

  return {
    promotedGames: promoted,
    correctedRounds,
    migratedPlaceholderPicks,
  };
}