import { createServiceClient } from "@/lib/supabase/service";
import { syncGolfLiveScoring } from "@/lib/platform/ingestion/golfLiveScoring";
import { computeGolfRoundPoints, computeGolfFinishPoints, refreshGolfLeagueStandings } from "@/lib/fantasy/golfScoring";

export async function checkWithdrawalsAndPromoteBench(leagueId: string, eventId: string) {
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("platform_events")
    .select("starts_at, metadata")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { promotions: 0 };

  const now = new Date();
  const startDate = new Date(event.starts_at);
  const dayOfTournament = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const shouldAutoPromote = dayOfTournament <= 2;
  if (!shouldAutoPromote) return { promotions: 0 };

  const { data: rosters } = await supabase
    .from("fantasy_rosters")
    .select("id, manager_id, canonical_id, entity_name")
    .eq("league_id", leagueId)
    .eq("event_id", eventId)
    .eq("roster_slot", "active")
    .eq("is_active", true);

  if (!rosters || rosters.length === 0) return { promotions: 0 };

  let promotions = 0;

  for (const rosterEntry of rosters) {
    const { data: liveScore } = await supabase
      .from("golf_live_scores")
      .select("is_withdrawn")
      .eq("event_id", eventId)
      .eq("canonical_player_id", rosterEntry.canonical_id)
      .eq("is_withdrawn", true)
      .limit(1)
      .maybeSingle();

    if (!liveScore) continue;

    const { data: benchEntry } = await supabase
      .from("fantasy_rosters")
      .select("id, canonical_id, entity_name")
      .eq("league_id", leagueId)
      .eq("event_id", eventId)
      .eq("manager_id", rosterEntry.manager_id)
      .eq("roster_slot", "bench")
      .eq("is_active", true)
      .maybeSingle();

    if (!benchEntry) continue;

    const { data: benchWithdrawn } = await supabase
      .from("golf_live_scores")
      .select("is_withdrawn")
      .eq("event_id", eventId)
      .eq("canonical_player_id", benchEntry.canonical_id)
      .eq("is_withdrawn", true)
      .limit(1)
      .maybeSingle();

    if (benchWithdrawn) continue;

    await supabase
      .from("fantasy_rosters")
      .update({ roster_slot: "active", acquired_via: "auto_bench_promotion" })
      .eq("id", benchEntry.id);

    await supabase
      .from("fantasy_rosters")
      .update({ is_active: false, dropped_at: new Date().toISOString() })
      .eq("id", rosterEntry.id);

    promotions++;
  }

  return { promotions };
}

export async function computeAndSaveGolfFantasyScores(leagueId: string, eventId: string) {
  const supabase = createServiceClient();

  const { data: rosters } = await supabase
    .from("fantasy_rosters")
    .select("manager_id, canonical_id, entity_name, roster_slot")
    .eq("league_id", leagueId)
    .eq("event_id", eventId)
    .eq("is_active", true);

  if (!rosters || rosters.length === 0) return { scoresComputed: 0 };

  let scoresComputed = 0;

  for (const roster of rosters) {
    const isBench = roster.roster_slot === "bench";

    const { data: roundScores } = await supabase
      .from("golf_live_scores")
      .select("*")
      .eq("event_id", eventId)
      .eq("canonical_player_id", roster.canonical_id)
      .order("round_number");

    if (!roundScores) continue;

    let totalPoints = 0;
    const totalBreakdown: Record<string, number> = {};

    for (const rs of roundScores) {
      if (!rs.is_round_complete) continue;

      const { points, breakdown } = computeGolfRoundPoints({
        canonicalId: roster.canonical_id,
        playerName: roster.entity_name,
        round: rs.round_number,
        scoreVsPar: rs.score_vs_par,
        madeCut: rs.made_cut,
        withdrawn: rs.is_withdrawn,
        finalPosition: rs.final_position,
        isBogeyFree: rs.is_bogey_free,
        isBestRoundOfDay: rs.is_best_round_of_day,
      });

      totalPoints += points;
      Object.entries(breakdown).forEach(([k, v]) => {
        totalBreakdown[`r${rs.round_number}_${k}`] = v;
      });

      await supabase
        .from("fantasy_scores")
        .upsert(
          {
            league_id: leagueId,
            event_id: eventId,
            manager_id: roster.manager_id,
            entity_type: "player",
            canonical_id: roster.canonical_id,
            entity_name: roster.entity_name,
            round_number: rs.round_number,
            points_breakdown: breakdown,
            total_points: points,
            is_bench: isBench,
            is_final: rs.is_round_complete,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "league_id,event_id,manager_id,canonical_id,round_number" }
        );

      scoresComputed++;
    }

    const lastRound = roundScores[roundScores.length - 1];
    const isTournamentComplete = lastRound?.final_position !== null;

    if (isTournamentComplete) {
      const { points: finishPoints, breakdown: finishBreakdown } = computeGolfFinishPoints({
        canonicalId: roster.canonical_id,
        playerName: roster.entity_name,
        round: 4,
        scoreVsPar: lastRound.score_vs_par,
        madeCut: lastRound.made_cut,
        withdrawn: lastRound.is_withdrawn,
        finalPosition: lastRound.final_position,
        isBogeyFree: lastRound.is_bogey_free,
        isBestRoundOfDay: lastRound.is_best_round_of_day,
      });

      totalPoints += finishPoints;
      Object.entries(finishBreakdown).forEach(([k, v]) => {
        totalBreakdown[`finish_${k}`] = v;
      });
    }

    await supabase
      .from("fantasy_scores")
      .upsert(
        {
          league_id: leagueId,
          event_id: eventId,
          manager_id: roster.manager_id,
          entity_type: "player",
          canonical_id: roster.canonical_id,
          entity_name: roster.entity_name,
          round_number: null,
          points_breakdown: totalBreakdown,
          total_points: totalPoints,
          is_bench: isBench,
          is_final: isTournamentComplete,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "league_id,event_id,manager_id,canonical_id,round_number" }
      );
  }

  await refreshGolfLeagueStandings(leagueId, eventId);
  return { scoresComputed };
}

export async function runGolfScoringSync(eventId: string) {
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("platform_events")
    .select("metadata, name")
    .eq("id", eventId)
    .maybeSingle();

  if (!event?.metadata) return { ok: false, error: "Event not found" };

  const tournamentId = (event.metadata as any).tournamentId;
  if (!tournamentId) return { ok: false, error: "No tournament ID in event metadata" };

  const syncResult = await syncGolfLiveScoring(String(tournamentId), eventId);
  if (!syncResult.ok) return syncResult;

  const { data: leagues } = await supabase
    .from("fantasy_leagues")
    .select("id")
    .eq("sport_key", "pga")
    .eq("current_event_id", eventId)
    .in("status", ["active", "drafting"]);

  if (!leagues || leagues.length === 0) {
    return { ok: true, message: "No active leagues for this event", playersScored: syncResult.playersScored };
  }

  let totalScores = 0;
  let totalPromotions = 0;

  for (const league of leagues) {
    const { promotions } = await checkWithdrawalsAndPromoteBench(league.id, eventId);
    const { scoresComputed } = await computeAndSaveGolfFantasyScores(league.id, eventId);
    totalPromotions += promotions;
    totalScores += scoresComputed;
  }

  return {
    ok: true,
    tournamentId,
    leaguesUpdated: leagues.length,
    scoresComputed: totalScores,
    benchPromotions: totalPromotions,
  };
}
