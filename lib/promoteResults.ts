import { createClient } from "@/lib/supabase/server";

const SCORING: Record<string, number> = {
  "First Four": 0,
  "Round of 64": 2,
  "Round of 32": 4,
  "Sweet 16": 7,
  "Elite Eight": 13,
  "Final Four": 20,
  Championship: 37,
};

function normalizeRound(round: string | null | undefined): string {
  const key = String(round ?? "")
    .toLowerCase()
    .trim();

  const map: Record<string, string> = {
    "first four": "First Four",
    "first-four": "First Four",
    "play-in": "First Four",
    "play in": "First Four",
    "round of 64": "Round of 64",
    "round-64": "Round of 64",
    "first round": "Round of 64",
    "round of 32": "Round of 32",
    "round-32": "Round of 32",
    "second round": "Round of 32",
    "sweet 16": "Sweet 16",
    "sweet-16": "Sweet 16",
    "elite 8": "Elite Eight",
    "elite eight": "Elite Eight",
    "elite-8": "Elite Eight",
    "final 4": "Final Four",
    "final four": "Final Four",
    "final-4": "Final Four",
    championship: "Championship",
    title: "Championship",
  };

  return map[key] ?? "Round of 64";
}

type ExternalFinalGame = {
  id: string;
  external_game_id: string;
  round_name: string | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  promoted_to_results: boolean | null;
};

type OfficialGameRow = {
  id: string;
  league_id: string;
  external_game_id: string | null;
  round_name: string;
  winning_team_id: string;
  losing_team_id: string;
};

type TeamRow = {
  id: string;
  is_play_in_actual: boolean | null;
};

export async function promoteResults() {
  const supabase = await createClient();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("public_slug", "2026-757-march-madness-draft")
    .single();

  if (leagueError || !league) {
    throw new Error("League not found");
  }

  const leagueId = league.id;

  const [{ data: finalGames, error: finalGamesError }, { data: teams, error: teamsError }] =
    await Promise.all([
      supabase
        .from("external_game_sync")
        .select(
          "id, external_game_id, round_name, mapped_home_team_id, mapped_away_team_id, home_score, away_score, promoted_to_results"
        )
        .eq("espn_status", "STATUS_FINAL"),
      supabase.from("teams").select("id, is_play_in_actual"),
    ]);

  if (finalGamesError) {
    throw new Error(finalGamesError.message);
  }

  if (teamsError) {
    throw new Error(teamsError.message);
  }

  const typedFinalGames = (finalGames ?? []) as ExternalFinalGame[];
  const typedTeams = (teams ?? []) as TeamRow[];
  const teamMap = new Map<string, TeamRow>(typedTeams.map((team) => [team.id, team]));

  let promoted = 0;

  for (const game of typedFinalGames) {
    if (
      !game.mapped_home_team_id ||
      !game.mapped_away_team_id ||
      game.home_score == null ||
      game.away_score == null
    ) {
      continue;
    }

    let winningTeamId: string | null = null;
    let losingTeamId: string | null = null;

    if (game.home_score > game.away_score) {
      winningTeamId = game.mapped_home_team_id;
      losingTeamId = game.mapped_away_team_id;
    } else if (game.away_score > game.home_score) {
      winningTeamId = game.mapped_away_team_id;
      losingTeamId = game.mapped_home_team_id;
    } else {
      continue;
    }

    const homeTeam = teamMap.get(game.mapped_home_team_id);
    const awayTeam = teamMap.get(game.mapped_away_team_id);

    const effectiveRoundName =
      homeTeam?.is_play_in_actual === true && awayTeam?.is_play_in_actual === true
        ? "First Four"
        : normalizeRound(game.round_name);

    const { data: existingGame, error: existingGameError } = await supabase
      .from("games")
      .select("id, league_id")
      .eq("external_game_id", game.external_game_id)
      .maybeSingle();

    if (existingGameError) {
      throw new Error(existingGameError.message);
    }

    if (existingGame) {
      const { error: updateExistingError } = await supabase
        .from("games")
        .update({
          league_id: leagueId,
          round_name: effectiveRoundName,
          winning_team_id: winningTeamId,
          losing_team_id: losingTeamId,
          status: "complete",
        })
        .eq("id", existingGame.id);

      if (updateExistingError) {
        throw new Error(updateExistingError.message);
      }
    } else {
      const { error: insertError } = await supabase.from("games").insert({
        league_id: leagueId,
        external_game_id: game.external_game_id,
        winning_team_id: winningTeamId,
        losing_team_id: losingTeamId,
        status: "complete",
        round_name: effectiveRoundName,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      promoted += 1;
    }

    if (!game.promoted_to_results) {
      const { error: updateError } = await supabase
        .from("external_game_sync")
        .update({ promoted_to_results: true })
        .eq("id", game.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }
  }

  const [{ data: officialGames, error: officialGamesError }, { data: picks, error: picksError }] =
    await Promise.all([
      supabase
        .from("games")
        .select("id, league_id, external_game_id, round_name, winning_team_id, losing_team_id")
        .eq("league_id", leagueId),
      supabase.from("picks").select("team_id"),
    ]);

  if (officialGamesError) {
    throw new Error(officialGamesError.message);
  }

  if (picksError) {
    throw new Error(picksError.message);
  }

  const typedOfficialGames = (officialGames ?? []) as OfficialGameRow[];
  const pickedTeamIds = new Set((picks ?? []).map((pick) => pick.team_id as string));

  const relevantTeamIds = new Set<string>();

  for (const game of typedOfficialGames) {
    relevantTeamIds.add(game.winning_team_id);
    relevantTeamIds.add(game.losing_team_id);
  }

  for (const teamId of pickedTeamIds) {
    relevantTeamIds.add(teamId);
  }

  const rebuiltTeamResults = Array.from(relevantTeamIds).map((teamId) => {
    const wins = typedOfficialGames.filter((game) => game.winning_team_id === teamId);
    const losses = typedOfficialGames.filter((game) => game.losing_team_id === teamId);

    const totalPoints = wins.reduce((sum, game) => {
      return sum + (SCORING[game.round_name] ?? 0);
    }, 0);

    return {
      league_id: leagueId,
      team_id: teamId,
      total_points: totalPoints,
      eliminated: losses.length > 0,
    };
  });

  const { error: deleteTeamResultsError } = await supabase
    .from("team_results")
    .delete()
    .eq("league_id", leagueId);

  if (deleteTeamResultsError) {
    throw new Error(deleteTeamResultsError.message);
  }

  if (rebuiltTeamResults.length > 0) {
    const { error: insertTeamResultsError } = await supabase
      .from("team_results")
      .insert(rebuiltTeamResults);

    if (insertTeamResultsError) {
      throw new Error(insertTeamResultsError.message);
    }
  }

  return {
    promotedGames: promoted,
    rebuiltTeamResults: rebuiltTeamResults.length,
  };
}