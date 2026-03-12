import { createClient } from "@/lib/supabase/server";

const SCORING: Record<string, number> = {
  "Round of 64": 2,
  "Round of 32": 4,
  "Sweet 16": 7,
  "Elite Eight": 13,
  "Final Four": 20,
  Championship: 37,
};

function normalizeRound(round: string): string {
  const key = round.toLowerCase().trim();

  const map: Record<string, string> = {
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

export async function syncPublicResults() {
  const supabase = await createClient();
  const baseUrl = process.env.NCAA_PUBLIC_FEED_BASE_URL;

  if (!baseUrl) {
    throw new Error("NCAA_PUBLIC_FEED_BASE_URL is not configured");
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("public_slug", "2026-757-march-madness-draft")
    .single();

  if (leagueError || !league) {
    throw new Error("League not found");
  }

  const response = await fetch(`${baseUrl}/games`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const completedGames = (payload.games ?? []).filter(
    (game: any) => String(game.status).toLowerCase() === "completed"
  );

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, school_name, external_team_id");

  if (teamsError) {
    throw teamsError;
  }

  const teamMap = new Map(
    (teams ?? []).map((team) => [team.external_team_id, team.id])
  );

  let applied = 0;
  let skipped = 0;

  for (const game of completedGames) {
    const winnerTeamId = teamMap.get(game.winner_team_id);
    const loserTeamId = teamMap.get(game.loser_team_id);
    const roundName = normalizeRound(game.round);

    if (!winnerTeamId || !loserTeamId) {
      skipped += 1;
      continue;
    }

    const { data: existingGame } = await supabase
      .from("games")
      .select("id")
      .eq("league_id", league.id)
      .eq("round_name", roundName)
      .eq("winning_team_id", winnerTeamId)
      .eq("losing_team_id", loserTeamId)
      .maybeSingle();

    if (existingGame) {
      skipped += 1;
      continue;
    }

    const points = SCORING[roundName] ?? 0;

    const { error: gameError } = await supabase.from("games").insert({
      league_id: league.id,
      external_game_id: String(game.id),
      round_name: roundName,
      winning_team_id: winnerTeamId,
      losing_team_id: loserTeamId,
      status: "complete",
    });

    if (gameError) {
      throw gameError;
    }

    const { data: winnerExisting } = await supabase
      .from("team_results")
      .select("*")
      .eq("league_id", league.id)
      .eq("team_id", winnerTeamId)
      .maybeSingle();

    const { data: loserExisting } = await supabase
      .from("team_results")
      .select("*")
      .eq("league_id", league.id)
      .eq("team_id", loserTeamId)
      .maybeSingle();

    const { error: winnerError } = await supabase.from("team_results").upsert(
      {
        league_id: league.id,
        team_id: winnerTeamId,
        eliminated: false,
        total_points: (winnerExisting?.total_points ?? 0) + points,
      },
      { onConflict: "league_id,team_id" }
    );

    if (winnerError) {
      throw winnerError;
    }

    const { error: loserError } = await supabase.from("team_results").upsert(
      {
        league_id: league.id,
        team_id: loserTeamId,
        eliminated: true,
        total_points: loserExisting?.total_points ?? 0,
      },
      { onConflict: "league_id,team_id" }
    );

    if (loserError) {
      throw loserError;
    }

    applied += 1;
  }

  return { applied, skipped };
}