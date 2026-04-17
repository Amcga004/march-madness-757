import { createServiceClient } from "@/lib/supabase/service";

const DEFAULT_RULES = {
  score_vs_par: true,
  cut_made: 2,
  cut_missed: -2,
  bogey_free_round: 1,
  best_round_of_day: 1,
  top_20_finish: 1,
  top_10_finish: 2,
  finish_3rd_5th: 3,
  finish_2nd: 4,
  finish_1st: 5,
};

interface PlayerRoundData {
  canonicalId: string;
  playerName: string;
  round: number;
  scoreVsPar: number | null;
  madeCut: boolean | null;
  withdrawn: boolean;
  finalPosition: number | null;
  isBogeyFree: boolean;
  isBestRoundOfDay: boolean;
}

export function computeGolfRoundPoints(
  data: PlayerRoundData,
  rules = DEFAULT_RULES
): { points: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let points = 0;

  // Score vs par
  if (rules.score_vs_par && data.scoreVsPar !== null && !data.withdrawn) {
    breakdown.score_vs_par = data.scoreVsPar * -1; // -8 under par = +8 points
    points += breakdown.score_vs_par;
  }

  // Bogey free round
  if (data.isBogeyFree && !data.withdrawn) {
    breakdown.bogey_free_round = rules.bogey_free_round;
    points += breakdown.bogey_free_round;
  }

  // Best round of the day
  if (data.isBestRoundOfDay && !data.withdrawn) {
    breakdown.best_round_of_day = rules.best_round_of_day;
    points += breakdown.best_round_of_day;
  }

  return { points, breakdown };
}

export function computeGolfFinishPoints(
  data: PlayerRoundData,
  rules = DEFAULT_RULES
): { points: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let points = 0;

  if (data.withdrawn) return { points: 0, breakdown: {} };

  // Cut result
  if (data.madeCut === true) {
    breakdown.cut_made = rules.cut_made;
    points += breakdown.cut_made;
  } else if (data.madeCut === false) {
    breakdown.cut_missed = rules.cut_missed;
    points += breakdown.cut_missed;
  }

  // Finish position bonuses
  if (data.finalPosition !== null) {
    if (data.finalPosition === 1) {
      breakdown.finish_1st = rules.finish_1st;
      points += breakdown.finish_1st;
    } else if (data.finalPosition === 2) {
      breakdown.finish_2nd = rules.finish_2nd;
      points += breakdown.finish_2nd;
    } else if (data.finalPosition >= 3 && data.finalPosition <= 5) {
      breakdown.finish_3rd_5th = rules.finish_3rd_5th;
      points += breakdown.finish_3rd_5th;
    } else if (data.finalPosition <= 10) {
      breakdown.top_10_finish = rules.top_10_finish;
      points += breakdown.top_10_finish;
    } else if (data.finalPosition <= 20) {
      breakdown.top_20_finish = rules.top_20_finish;
      points += breakdown.top_20_finish;
    }
  }

  return { points, breakdown };
}

export async function refreshGolfLeagueStandings(
  leagueId: string,
  eventId: string
) {
  const supabase = createServiceClient();

  const { data: members } = await supabase
    .from("fantasy_memberships")
    .select("user_id, display_name")
    .eq("league_id", leagueId);

  if (!members || members.length === 0) return;

  for (const member of members) {
    // Sum all active player scores for this manager this event
    const { data: scores } = await supabase
      .from("fantasy_scores")
      .select("total_points, is_bench")
      .eq("league_id", leagueId)
      .eq("event_id", eventId)
      .eq("manager_id", member.user_id)
      .eq("is_bench", false)
      .is("round_number", null); // total scores only

    const eventPoints = scores?.reduce(
      (sum, s) => sum + (s.total_points ?? 0),
      0
    ) ?? 0;

    // Get season total
    const { data: allEventStandings } = await supabase
      .from("fantasy_standings")
      .select("event_points")
      .eq("league_id", leagueId)
      .eq("manager_id", member.user_id)
      .neq("event_id", eventId);

    const priorPoints = allEventStandings?.reduce(
      (sum, s) => sum + (s.event_points ?? 0),
      0
    ) ?? 0;

    const seasonPoints = priorPoints + eventPoints;

    await supabase
      .from("fantasy_standings")
      .upsert(
        {
          league_id: leagueId,
          event_id: eventId,
          manager_id: member.user_id,
          display_name: member.display_name,
          event_points: eventPoints,
          season_points: seasonPoints,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "league_id,event_id,manager_id" }
      );
  }

  // Update ranks
  const { data: standings } = await supabase
    .from("fantasy_standings")
    .select("id, event_points, season_points")
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
