import { createClient } from "@/lib/supabase/server";

function normalize(name?: string | null) {
  if (!name) return "";

  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .replace(/\s+/g, " ")
    .trim();
}

export async function mapEspnTeamsToInternal() {
  const supabase = await createClient();

  // Pull ESPN sync rows
  const { data: games, error: gamesError } = await supabase
    .from("external_game_sync")
    .select("*");

  if (gamesError) throw new Error(gamesError.message);

  // Pull internal teams
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, school_name, normalized_name");

  if (teamsError) throw new Error(teamsError.message);

  let mapped = 0;

  for (const game of games || []) {
    if (!game.home_team_name || !game.away_team_name) continue;

    const homeNorm = normalize(game.home_team_name);
    const awayNorm = normalize(game.away_team_name);

    const homeMatch = teams.find(
      (t) =>
        homeNorm.includes(t.normalized_name) ||
        t.normalized_name.includes(homeNorm)
    );

    const awayMatch = teams.find(
      (t) =>
        awayNorm.includes(t.normalized_name) ||
        t.normalized_name.includes(awayNorm)
    );

    const { error } = await supabase
      .from("external_game_sync")
      .update({
        mapped_home_team_id: homeMatch?.id ?? null,
        mapped_away_team_id: awayMatch?.id ?? null,
      })
      .eq("id", game.id);

    if (error) throw new Error(error.message);

    mapped++;
  }

  return {
    mappedRows: mapped,
  };
}