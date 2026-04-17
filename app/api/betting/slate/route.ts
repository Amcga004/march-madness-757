import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const sport = searchParams.get("sport");
  const includeSignals = searchParams.get("signals") === "true";

  const supabase = createServiceClient();

  // Check auth for signals
  let authed = false;
  if (includeSignals) {
    try {
      await requireUser();
      authed = true;
    } catch {
      authed = false;
    }
  }

  try {
    // Fetch matchup data — public
    let oddsQuery = supabase
      .from("market_odds")
      .select("external_game_id, home_team, away_team, bookmaker, market_type, home_price, away_price, over_price, under_price, spread_home, line_value, commence_time")
      .gte("commence_time", `${date}T00:00:00Z`)
      .lt("commence_time", `${date}T23:59:59Z`)
      .order("commence_time");

    if (sport) oddsQuery = oddsQuery.eq("sport_key", sport);

    const { data: odds } = await oddsQuery;

    // Fetch consensus — public
    let consensusQuery = supabase
      .from("consensus")
      .select("external_game_id, home_team, away_team, sport_key, consensus_home_win_prob, consensus_away_win_prob, consensus_total, confidence_tier, model_available, odds_available")
      .eq("game_date", date);

    if (sport) consensusQuery = consensusQuery.eq("sport_key", sport);
    const { data: consensus } = await consensusQuery;

    // Fetch team stats — public
    const { data: teamStats } = await supabase
      .from("team_stats_cache")
      .select("team_name, sport_key, stats, season");

    // Fetch pitcher stats for MLB — public
    const { data: pitcherStats } = await supabase
      .from("pitcher_stats_cache")
      .select("player_name, era, whip, fip, xera, k_pct, bb_pct, innings_pitched")
      .eq("season", "2025");

    // Signals — auth gated
    let signals = null;
    if (includeSignals && authed) {
      let signalQuery = supabase
        .from("signals")
        .select("*")
        .eq("game_date", date)
        .eq("suppressed", false)
        .order("edge_pct", { ascending: false });

      if (sport) signalQuery = signalQuery.eq("sport_key", sport);
      const { data } = await signalQuery;
      signals = data;
    }

    // Group everything by game
    const gameMap = new Map<string, any>();

    for (const odd of odds ?? []) {
      if (!gameMap.has(odd.external_game_id)) {
        gameMap.set(odd.external_game_id, {
          gameId: odd.external_game_id,
          homeTeam: odd.home_team,
          awayTeam: odd.away_team,
          commenceTime: odd.commence_time,
          odds: [],
          consensus: null,
          signals: [],
          homeStats: null,
          awayStats: null,
          homePitcher: null,
          awayPitcher: null,
        });
      }
      gameMap.get(odd.external_game_id).odds.push(odd);
    }

    for (const c of consensus ?? []) {
      if (gameMap.has(c.external_game_id)) {
        gameMap.get(c.external_game_id).consensus = c;
      }
    }

    if (signals) {
      for (const signal of signals) {
        if (gameMap.has(signal.external_game_id)) {
          gameMap.get(signal.external_game_id).signals.push(signal);
        }
      }
    }

    // Attach team stats
    const statsMap = new Map<string, any>();
    for (const stat of teamStats ?? []) {
      statsMap.set(stat.team_name, stat.stats);
    }

    for (const [, game] of gameMap) {
      game.homeStats = statsMap.get(game.homeTeam) ?? null;
      game.awayStats = statsMap.get(game.awayTeam) ?? null;
    }

    const slate = Array.from(gameMap.values()).sort(
      (a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime()
    );

    return NextResponse.json({
      ok: true,
      date,
      sport: sport ?? "all",
      signalsIncluded: authed && includeSignals,
      gamesCount: slate.length,
      slate,
      pitcherStats: pitcherStats ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch slate";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
