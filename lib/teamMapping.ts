import { createClient } from "@/lib/supabase/server";
import { getInternalAliasKeys, normalizeTeamAlias } from "@/lib/teamAliases";

type TeamRow = {
  id: string;
  school_name: string;
};

type ExternalGameSyncRow = {
  id: string;
  home_team_name: string | null;
  away_team_name: string | null;
  mapped_home_team_id: string | null;
  mapped_away_team_id: string | null;
};

export async function mapEspnTeamsToInternal() {
  const supabase = await createClient();

  const [{ data: teams, error: teamsError }, { data: externalRows, error: externalError }] =
    await Promise.all([
      supabase.from("teams").select("id, school_name").order("school_name", { ascending: true }),
      supabase
        .from("external_game_sync")
        .select("id, home_team_name, away_team_name, mapped_home_team_id, mapped_away_team_id"),
    ]);

  if (teamsError) {
    throw new Error(teamsError.message || "Failed to load teams for mapping.");
  }

  if (externalError) {
    throw new Error(externalError.message || "Failed to load external game sync rows.");
  }

  const typedTeams = (teams ?? []) as TeamRow[];
  const typedExternalRows = (externalRows ?? []) as ExternalGameSyncRow[];

  const teamLookup = new Map<string, string>();

  for (const team of typedTeams) {
    const aliasKeys = getInternalAliasKeys(team.school_name);

    for (const aliasKey of aliasKeys) {
      if (!teamLookup.has(aliasKey)) {
        teamLookup.set(aliasKey, team.id);
      }
    }
  }

  let mappedRows = 0;

  for (const row of typedExternalRows) {
    const normalizedHome = normalizeTeamAlias(row.home_team_name);
    const normalizedAway = normalizeTeamAlias(row.away_team_name);

    const mappedHomeTeamId = normalizedHome ? teamLookup.get(normalizedHome) ?? null : null;
    const mappedAwayTeamId = normalizedAway ? teamLookup.get(normalizedAway) ?? null : null;

    const homeChanged = mappedHomeTeamId !== row.mapped_home_team_id;
    const awayChanged = mappedAwayTeamId !== row.mapped_away_team_id;

    if (!homeChanged && !awayChanged) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("external_game_sync")
      .update({
        mapped_home_team_id: mappedHomeTeamId,
        mapped_away_team_id: mappedAwayTeamId,
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to update mapped team ids.");
    }

    mappedRows += 1;
  }

  return {
    mappedRows,
  };
}