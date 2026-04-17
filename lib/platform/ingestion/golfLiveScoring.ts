import { createServiceClient } from "@/lib/supabase/service";
import { recordSyncSuccess, recordSyncFailure, saveSnapshot } from "@/lib/platform/sourceRegistry";

const SPORTSDATA_BASE = "https://api.sportsdata.io/golf/v2/json";

async function fetchSportsDataIo(endpoint: string): Promise<any> {
  const key = process.env.SPORTS_DATA_IO_KEY;
  if (!key) throw new Error("SPORTS_DATA_IO_KEY not configured");
  const res = await fetch(`${SPORTSDATA_BASE}/${endpoint}?key=${key}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SportsDataIO fetch failed: ${res.status}`);
  return res.json();
}

export interface PlayerRoundScore {
  playerId: string;
  playerName: string;
  round: number;
  scoreVsPar: number | null;
  totalVsPar: number | null;
  holesCompleted: number;
  isBogeyFree: boolean;
  isWithdrawn: boolean;
  madeCut: boolean | null;
  finalPosition: number | null;
  isComplete: boolean;
}

export async function fetchGolfLeaderboard(tournamentId: string): Promise<PlayerRoundScore[]> {
  const data = await fetchSportsDataIo(`Leaderboard/${tournamentId}`);
  const players = data.Players ?? [];
  const results: PlayerRoundScore[] = [];

  for (const player of players) {
    const rounds = player.Rounds ?? [];
    const isWithdrawn = player.IsWithdrawn ?? false;
    const madeCut = player.MadeCut ?? null;
    const finalPosition = player.Rank ?? null;

    for (const round of rounds) {
      if (!round.Number) continue;
      const strokes = round.Strokes ?? null;
      const par = round.Par ?? null;
      const scoreVsPar = strokes !== null && par !== null ? strokes - par : null;
      const holesCompleted = round.HolesCompleted ?? 0;
      const isBogeyFree = round.BogeyFree ?? false;
      const isComplete = holesCompleted >= 18;

      results.push({
        playerId: String(player.PlayerID),
        playerName: `${player.FirstName ?? ""} ${player.LastName ?? ""}`.trim(),
        round: round.Number,
        scoreVsPar,
        totalVsPar: player.TotalScore ?? null,
        holesCompleted,
        isBogeyFree,
        isWithdrawn: isWithdrawn && isComplete === false,
        madeCut,
        finalPosition,
        isComplete,
      });
    }
  }

  return results;
}

export async function detectBestRoundsOfDay(
  scores: PlayerRoundScore[],
  roundNumber: number
): Promise<Set<string>> {
  const roundScores = scores.filter(
    (s) => s.round === roundNumber && s.isComplete && !s.isWithdrawn && s.scoreVsPar !== null
  );
  if (roundScores.length === 0) return new Set();
  const best = Math.min(...roundScores.map((s) => s.scoreVsPar!));
  return new Set(
    roundScores.filter((s) => s.scoreVsPar === best).map((s) => s.playerId)
  );
}

export async function syncGolfLiveScoring(tournamentId: string, eventId: string) {
  const supabase = createServiceClient();
  try {
    const scores = await fetchGolfLeaderboard(tournamentId);
    await saveSnapshot("sportsdata_golf", "pga", "leaderboard", { tournamentId, playerCount: scores.length });

    const rounds = [...new Set(scores.map((s) => s.round))];
    const bestRoundSets: Map<number, Set<string>> = new Map();
    for (const round of rounds) {
      bestRoundSets.set(round, await detectBestRoundsOfDay(scores, round));
    }

    for (const score of scores) {
      const { data: mapping } = await supabase
        .from("source_identity_map")
        .select("canonical_id")
        .eq("source_key", "sportsdata_golf")
        .eq("source_id", score.playerId)
        .eq("entity_type", "player")
        .maybeSingle();

      if (!mapping) continue;

      const isBestRound = bestRoundSets.get(score.round)?.has(score.playerId) ?? false;

      await supabase
        .from("golf_live_scores")
        .upsert(
          {
            event_id: eventId,
            canonical_player_id: mapping.canonical_id,
            player_name: score.playerName,
            round_number: score.round,
            score_vs_par: score.scoreVsPar,
            total_vs_par: score.totalVsPar,
            holes_completed: score.holesCompleted,
            is_bogey_free: score.isBogeyFree,
            is_best_round_of_day: isBestRound,
            is_withdrawn: score.isWithdrawn,
            made_cut: score.madeCut,
            final_position: score.finalPosition,
            is_round_complete: score.isComplete,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "event_id,canonical_player_id,round_number" }
        );
    }

    await recordSyncSuccess("sportsdata_golf");
    return { ok: true, playersScored: scores.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure("sportsdata_golf", message);
    return { ok: false, error: message };
  }
}
