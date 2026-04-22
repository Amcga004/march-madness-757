import { createServiceClient } from "@/lib/supabase/service";
import { americanToImpliedProb } from "@/lib/betting/oddsIngestion";

type SignalTier = "strong_value" | "lean_value" | "fair" | "lean_avoid" | "avoid";

function getSignalTier(edgePct: number): SignalTier {
  if (edgePct >= 8) return "strong_value";
  if (edgePct >= 4) return "lean_value";
  if (edgePct >= -4) return "fair";
  if (edgePct >= -8) return "lean_avoid";
  return "avoid";
}

function computeEV(
  consensusProb: number,
  americanOdds: number,
  stake = 100
): number {
  const payout = americanOdds > 0 ? americanOdds : 100 / Math.abs(americanOdds) * 100;
  const ev = consensusProb * payout - (1 - consensusProb) * stake;
  return Math.round(ev * 100) / 100;
}

function findBestOdds(
  odds: any[],
  gameId: string,
  marketType: string,
  side: "home" | "away" | "over" | "under"
): { price: number; bookmaker: string } | null {
  let best: { price: number; bookmaker: string } | null = null;

  const gameOdds = odds.filter((o) => o.external_game_id === gameId && o.market_type === marketType);

  for (const odd of gameOdds) {
    let price: number | null = null;

    if (side === "home") price = odd.home_price;
    else if (side === "away") price = odd.away_price;
    else if (side === "over") price = odd.over_price;
    else if (side === "under") price = odd.under_price;

    if (price === null) continue;

    if (best === null || price > best.price) {
      best = { price, bookmaker: odd.bookmaker };
    }
  }

  return best;
}

export async function computeConsensusForDate(date: string) {
  const supabase = createServiceClient();

  const { data: modelOutputs } = await supabase
    .from("model_outputs")
    .select("*")
    .eq("game_date", date)
    .eq("is_stale", false);

  const nextDay = new Date(new Date(`${date}T12:00:00`).getTime() + 86400000).toISOString().split("T")[0];
  const { data: marketOdds } = await supabase
    .from("market_odds")
    .select("*")
    .gte("commence_time", `${date}T00:00:00Z`)
    .lt("commence_time", `${nextDay}T12:00:00Z`);

  if (!modelOutputs || !marketOdds) return { ok: false, error: "No data found" };

  // Group odds by game
  const oddsByGame = new Map<string, any[]>();
  for (const odd of marketOdds) {
    const existing = oddsByGame.get(odd.external_game_id) ?? [];
    existing.push(odd);
    oddsByGame.set(odd.external_game_id, existing);
  }

  let computed = 0;

  for (const model of modelOutputs) {
    const gameOdds = oddsByGame.get(model.external_game_id) ?? [];
    const h2hOdds = gameOdds.filter((o) => o.market_type === "h2h");

    if (h2hOdds.length === 0) continue;

    // Get best moneyline for market implied prob
    const bestHome = findBestOdds(gameOdds, model.external_game_id, "h2h", "home");
    const bestAway = findBestOdds(gameOdds, model.external_game_id, "h2h", "away");

    if (!bestHome || !bestAway) continue;

    const marketHomeProb = americanToImpliedProb(bestHome.price);
    const marketAwayProb = americanToImpliedProb(bestAway.price);

    // Remove vig
    const vigTotal = marketHomeProb + marketAwayProb;
    const fairHomeProb = marketHomeProb / vigTotal;
    const fairAwayProb = marketAwayProb / vigTotal;

    // Consensus = model probability (market proxy for MLB)
    const consensusHomeProb = model.home_win_probability ?? fairHomeProb;
    const consensusAwayProb = model.away_win_probability ?? fairAwayProb;

    // Determine confidence tier
    const isMarketProxy = (model.model_metadata as any)?.proxy === true;
    const confidenceTier = isMarketProxy ? "market_only" :
      model.home_win_probability !== null ? "high" : "insufficient";

    await supabase
      .from("consensus")
      .upsert(
        {
          sport_key: model.sport_key,
          external_game_id: model.external_game_id,
          game_date: date,
          home_team: model.home_team,
          away_team: model.away_team,
          consensus_home_win_prob: consensusHomeProb,
          consensus_away_win_prob: consensusAwayProb,
          consensus_total: model.predicted_total,
          model_source: model.source_key,
          market_implied_home_prob: fairHomeProb,
          market_implied_away_prob: fairAwayProb,
          best_line_home: bestHome.price,
          best_line_away: bestAway.price,
          best_bookmaker: bestHome.price > bestAway.price ? bestHome.bookmaker : bestAway.bookmaker,
          confidence_tier: confidenceTier,
          model_available: !isMarketProxy,
          odds_available: true,
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "external_game_id,game_date" }
      );

    computed++;
  }

  return { ok: true, consensusComputed: computed, date };
}

export async function generateSignalsForDate(date: string) {
  const supabase = createServiceClient();

  const { data: consensusRows } = await supabase
    .from("consensus")
    .select("*")
    .eq("game_date", date)
    .eq("odds_available", true);

  if (!consensusRows || consensusRows.length === 0) {
    return { ok: true, signalsGenerated: 0, message: "No consensus data" };
  }

  const nextDay = new Date(new Date(`${date}T12:00:00`).getTime() + 86400000).toISOString().split("T")[0];
  const { data: marketOdds } = await supabase
    .from("market_odds")
    .select("*")
    .gte("commence_time", `${date}T00:00:00Z`)
    .lt("commence_time", `${nextDay}T12:00:00Z`);

  let generated = 0;

  for (const consensus of consensusRows) {
    if (!consensus.consensus_home_win_prob || !consensus.consensus_away_win_prob) continue;

    const gameOdds = (marketOdds ?? []).filter(
      (o) => o.external_game_id === consensus.external_game_id
    );

    // closing_line = true rows only exist once a game has gone live (snapshotted at start)
    // If any exist, the game has already started — suppress signals and skip
    const hasClosingLine = gameOdds.some((o) => o.closing_line === true);
    if (hasClosingLine) {
      await supabase
        .from("signals")
        .update({ suppressed: true, suppression_reason: "game_live", updated_at: new Date().toISOString() })
        .eq("external_game_id", consensus.external_game_id)
        .eq("suppressed", false);
      continue;
    }

    // Pre-game: only closing_line = false rows exist — use these for signal generation
    const oddsToUse = gameOdds.filter((o) => o.closing_line === false);
    if (oddsToUse.length === 0) continue;

    const bestHome = findBestOdds(oddsToUse, consensus.external_game_id, "h2h", "home");
    const bestAway = findBestOdds(oddsToUse, consensus.external_game_id, "h2h", "away");

    if (bestHome && bestAway) {
      // Devig both sides together so edge is against the fair no-vig line
      const rawHome = americanToImpliedProb(bestHome.price);
      const rawAway = americanToImpliedProb(bestAway.price);
      const vigTotal = rawHome + rawAway;
      const fairHomeProb = rawHome / vigTotal;
      const fairAwayProb = rawAway / vigTotal;

      const rawHomeEdge = (consensus.consensus_home_win_prob - fairHomeProb) * 100;
      const homeEdgePct = Math.max(-25, Math.min(25, Math.round(rawHomeEdge * 10) / 10));
      const homeEvValue = computeEV(consensus.consensus_home_win_prob, bestHome.price);
      const homeTier = getSignalTier(homeEdgePct);

      await supabase
        .from("signals")
        .upsert(
          {
            sport_key: consensus.sport_key,
            external_game_id: consensus.external_game_id,
            game_date: date,
            home_team: consensus.home_team,
            away_team: consensus.away_team,
            signal_type: "h2h",
            side: "home",
            edge_pct: homeEdgePct,
            ev_value: homeEvValue,
            consensus_prob: consensus.consensus_home_win_prob,
            market_implied_prob: fairHomeProb,
            best_price: bestHome.price,
            best_bookmaker: bestHome.bookmaker,
            tier: homeTier,
            is_visible: true,
            suppressed: consensus.confidence_tier === "insufficient",
            suppression_reason: consensus.confidence_tier === "insufficient"
              ? "no_model"
              : null,
            pitcher_confirmed: null,
            starter_flag: null,
            computed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_game_id,signal_type,side" }
        );

      generated++;

      const rawAwayEdge = (consensus.consensus_away_win_prob - fairAwayProb) * 100;
      const awayEdgePct = Math.max(-25, Math.min(25, Math.round(rawAwayEdge * 10) / 10));
      const awayEvValue = computeEV(consensus.consensus_away_win_prob, bestAway.price);
      const awayTier = getSignalTier(awayEdgePct);

      await supabase
        .from("signals")
        .upsert(
          {
            sport_key: consensus.sport_key,
            external_game_id: consensus.external_game_id,
            game_date: date,
            home_team: consensus.home_team,
            away_team: consensus.away_team,
            signal_type: "h2h",
            side: "away",
            edge_pct: awayEdgePct,
            ev_value: awayEvValue,
            consensus_prob: consensus.consensus_away_win_prob,
            market_implied_prob: fairAwayProb,
            best_price: bestAway.price,
            best_bookmaker: bestAway.bookmaker,
            tier: awayTier,
            is_visible: true,
            suppressed: consensus.confidence_tier === "insufficient",
            suppression_reason: consensus.confidence_tier === "insufficient"
              ? "no_model"
              : null,
            pitcher_confirmed: null,
            starter_flag: null,
            computed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_game_id,signal_type,side" }
        );

      generated++;
    }
  }

  return { ok: true, signalsGenerated: generated, date };
}

export async function runFullBettingSync(date: string) {
  const results: Record<string, any> = {};

  const consensus = await computeConsensusForDate(date);
  results.consensus = consensus;

  const signals = await generateSignalsForDate(date);
  results.signals = signals;

  return { ok: true, date, ...results };
}
