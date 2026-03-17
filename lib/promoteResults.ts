import { createClient } from "@/lib/supabase/server";

export async function promoteResults() {
  const supabase = await createClient();

  // 1. Get completed ESPN games that haven't been promoted
  const { data: games, error } = await supabase
    .from("external_game_sync")
    .select("*")
    .eq("espn_status", "STATUS_FINAL")
    .eq("promoted_to_results", false);

  if (error) throw new Error(error.message);

  let promoted = 0;

  for (const game of games || []) {
    if (
      !game.mapped_home_team_id ||
      !game.mapped_away_team_id ||
      game.home_score == null ||
      game.away_score == null
    ) {
      continue;
    }

    let winningTeamId = null;
    let losingTeamId = null;

    if (game.home_score > game.away_score) {
      winningTeamId = game.mapped_home_team_id;
      losingTeamId = game.mapped_away_team_id;
    } else if (game.away_score > game.home_score) {
      winningTeamId = game.mapped_away_team_id;
      losingTeamId = game.mapped_home_team_id;
    } else {
      continue; // skip ties (shouldn't happen)
    }

    // 2. Insert into your official games table
    const { error: insertError } = await supabase
      .from("games")
      .insert({
        external_game_id: game.external_game_id,
        winning_team_id: winningTeamId,
        losing_team_id: losingTeamId,
        status: "FINAL",
        round_name: game.round_name ?? "Round of 64",
      });

    if (insertError) throw new Error(insertError.message);

    // 3. Mark as promoted so we don’t double count
    const { error: updateError } = await supabase
      .from("external_game_sync")
      .update({ promoted_to_results: true })
      .eq("id", game.id);

    if (updateError) throw new Error(updateError.message);

    promoted++;
  }

  return {
    promotedGames: promoted,
  };
}