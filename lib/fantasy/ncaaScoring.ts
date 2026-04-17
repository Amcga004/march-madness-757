import { createServiceClient } from "@/lib/supabase/service";

const DEFAULT_RULES = {
  round_of_64_win: 1,
  round_of_32_win: 2,
  sweet_16_win: 3,
  elite_8_win: 4,
  final_four_win: 5,
  championship_win: 6,
  score_100_plus: 1,
  upset_5_seed_diff: 1,
  upset_10_seed_diff: 2,
};

const ROUND_KEYS: Record<string, keyof typeof DEFAULT_RULES> = {
  "Round of 64": "round_of_64_win",
  "Round of 32": "round_of_32_win",
  "Sweet 16": "sweet_16_win",
  "Elite Eight": "elite_8_win",
  "Final Four": "final_four_win",
  "Championship": "championship_win",
};

interface GameResult {
  winnerCanonicalId: string;
  winnerName: string;
  winnerSeed: number;
  loserSeed: number;
  winnerScore: number;
  roundName: string;
}

export function computeNcaaWinPoints(
  result: GameResult,
  rules = DEFAULT_RULES
): { points: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let points = 0;

  // Round win points
  const roundKey = ROUND_KEYS[result.roundName];
  if (roundKey && rules[roundKey]) {
    breakdown[roundKey] = rules[roundKey];
    points += breakdown[roundKey];
  }

  // 100+ point bonus
  if (result.winnerScore >= 100) {
    breakdown.score_100_plus = rules.score_100_plus;
    points += breakdown.score_100_plus;
  }

  // Upset bonuses
  const seedDiff = result.loserSeed - result.winnerSeed;
  if (seedDiff >= 10) {
    breakdown.upset_10_seed_diff = rules.upset_10_seed_diff;
    points += breakdown.upset_10_seed_diff;
  } else if (seedDiff >= 5) {
    breakdown.upset_5_seed_diff = rules.upset_5_seed_diff;
    points += breakdown.upset_5_seed_diff;
  }

  return { points, breakdown };
}

export async function recordNcaaGameResult(params: {
  leagueId: string;
  eventId: string;
  result: GameResult;
}) {
  const supabase = createServiceClient();
  const { points, breakdown } = computeNcaaWinPoints(params.result);

  // Find all managers who have this team
  const { data: rosters } = await supabase
    .from("fantasy_rosters")
    .select("manager_id, entity_name")
    .eq("league_id", params.leagueId)
    .eq("canonical_id", params.result.winnerCanonicalId)
    .eq("is_active", true);

  if (!rosters || rosters.length === 0) return { pointsAwarded: 0 };

  for (const roster of rosters) {
    // Get existing score for this team this event
    const { data: existing } = await supabase
      .from("fantasy_scores")
      .select("id, total_points, points_breakdown")
      .eq("league_id", params.leagueId)
      .eq("event_id", params.eventId)
      .eq("manager_id", roster.manager_id)
      .eq("canonical_id", params.result.winnerCanonicalId)
      .is("round_number", null)
      .maybeSingle();

    if (existing) {
      const newTotal = (existing.total_points ?? 0) + points;
      const newBreakdown = {
        ...(existing.points_breakdown as Record<string, number>),
        [params.result.roundName]: {
          ...(existing.points_breakdown as any)?.[params.result.roundName],
          ...breakdown,
        },
      };

      await supabase
        .from("fantasy_scores")
        .update({
          total_points: newTotal,
          points_breakdown: newBreakdown,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("fantasy_scores").insert({
        league_id: params.leagueId,
        event_id: params.eventId,
        manager_id: roster.manager_id,
        entity_type: "team",
        canonical_id: params.result.winnerCanonicalId,
        entity_name: params.result.winnerName,
        round_number: null,
        points_breakdown: {
          [params.result.roundName]: breakdown,
        },
        total_points: points,
        is_bench: false,
        is_final: false,
      });
    }
  }

  return { pointsAwarded: points, managersUpdated: rosters.length };
}

export async function refreshNcaaStandings(
  leagueId: string,
  eventId: string
) {
  const supabase = createServiceClient();

  const { data: members } = await supabase
    .from("fantasy_memberships")
    .select("user_id, display_name")
    .eq("league_id", leagueId);

  if (!members) return;

  for (const member of members) {
    const { data: scores } = await supabase
      .from("fantasy_scores")
      .select("total_points")
      .eq("league_id", leagueId)
      .eq("event_id", eventId)
      .eq("manager_id", member.user_id)
      .is("round_number", null);

    const total = scores?.reduce(
      (sum, s) => sum + (s.total_points ?? 0),
      0
    ) ?? 0;

    await supabase
      .from("fantasy_standings")
      .upsert(
        {
          league_id: leagueId,
          event_id: eventId,
          manager_id: member.user_id,
          display_name: member.display_name,
          event_points: total,
          season_points: total,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "league_id,event_id,manager_id" }
      );
  }

  // Update ranks
  const { data: standings } = await supabase
    .from("fantasy_standings")
    .select("id, event_points")
    .eq("league_id", leagueId)
    .eq("event_id", eventId)
    .order("event_points", { ascending: false });

  if (standings) {
    for (let i = 0; i < standings.length; i++) {
      await supabase
        .from("fantasy_standings")
        .update({ rank: i + 1 })
        .eq("id", standings[i].id);
    }
  }
}
