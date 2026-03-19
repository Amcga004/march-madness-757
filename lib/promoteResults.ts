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

  // Pull every final ESPN game so we can safely backfill anything that was
  // previously promoted without team_results being rebuilt.
  const { data: finalGames, error: finalGamesError } = await supabase
    .from("external_game_sync")
    .select(
      "id, external_game_id, round_name, mapped_home_team_id, mapped_away_team_id, home_score, away_score, promoted_to_results"
    )
    .eq("espn_status", "STATUS_FINAL");

  if (finalGamesError) {
    throw new Error(finalGamesError.message);
  }

  const typedFinalGames = (finalGames ?? []) as ExternalFinalGame[];

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

    const normalizedRound = normalizeRound(game.round_name);

    // Prevent duplicate official game inserts by external_game_id first.
    const { data: existingByExternalId, error: existingByExternalIdError } = await supabase
      .from("games")
      .select("id")
      .eq("league_id", leagueId)
      .eq("external_game_id", game.external_game_id)
      .maybeSingle();

    if (existingByExternalIdError) {
      throw new Error(existingByExternalIdError.message);
    }

    if (!existingByExternalId) {
      const { error: insertError } = await supabase.from("games").insert({
        league_id: leagueId,
        external_game_id: game.external_game_id,
        winning_team_id: winningTeamId,
        losing_team_id: losingTeamId,
        status: "complete",
        round_name: normalizedRound,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      promoted += 1;
    }

    // Mark promoted so your sync feed stays clean.
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

  // Rebuild team_results from scratch so standings always match official games.
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
      return sum + (SCORING[normalizeRound(game.round_name)] ?? 0);
    }, 0);

    return {
      league_id: leagueId,
      team_id: teamId,
      total_points: totalPoints,
      eliminated: losses.length > 0,
    };
  });

  // Full rebuild prevents stale / partial scoring state.
  const { error: deleteTeamResultsError } = await supabase
    .from("team_results")
    .delete()
    .eq("league_id", leagueId);

  if (deleteTeamResultsError) {
    throw new Error(deleteTeamResultsError.message);
  }

  if (rebuiltTeamResults.length > 0) {
    const { error: upsertTeamResultsError } = await supabase
      .from("team_results")
      .insert(rebuiltTeamResults);

    if (upsertTeamResultsError) {
      throw new Error(upsertTeamResultsError.message);
    }
  }

  return {
    promotedGames: promoted,
    rebuiltTeamResults: rebuiltTeamResults.length,
  };
}