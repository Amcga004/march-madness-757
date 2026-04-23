import { createServiceClient } from "@/lib/supabase/service";
import { recordSyncSuccess, recordSyncFailure } from "@/lib/platform/sourceRegistry";
import { americanToImpliedProb } from "@/lib/betting/oddsIngestion";

// ─── KENPOM (CBB) ────────────────────────────────────────────────────────────

export async function ingestKenpomPredictions(date: string) {
  const supabase = createServiceClient();
  const apiKey = process.env.KENPOM_API_KEY;
  if (!apiKey) return { ok: false, error: "KENPOM_API_KEY not configured" };

  try {
    const res = await fetch(
      `https://kenpom.com/api.php?endpoint=fanmatch&d=${date}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) throw new Error(`KenPom fetch failed: ${res.status}`);
    const games = await res.json();

    if (!Array.isArray(games)) throw new Error("Unexpected KenPom response format");

    let upserted = 0;

    for (const game of games) {
      const homeWinProb = game.HomeWP ? game.HomeWP / 100 : null;
      const awayWinProb = homeWinProb !== null ? 1 - homeWinProb : null;
      const predictedTotal =
        game.HomePred && game.VisitorPred
          ? parseFloat(game.HomePred) + parseFloat(game.VisitorPred)
          : null;

      const externalGameId = `kenpom_${date}_${game.Home}_${game.Visitor}`
        .replace(/\s+/g, "_")
        .toLowerCase();

      await supabase
        .from("model_outputs")
        .upsert(
          {
            sport_key: "ncaab",
            source_key: "kenpom",
            external_game_id: externalGameId,
            game_date: date,
            home_team: game.Home,
            away_team: game.Visitor,
            home_win_probability: homeWinProb,
            away_win_probability: awayWinProb,
            predicted_home_score: game.HomePred ? parseFloat(game.HomePred) : null,
            predicted_away_score: game.VisitorPred ? parseFloat(game.VisitorPred) : null,
            predicted_total: predictedTotal,
            model_metadata: {
              homeRank: game.HomeRank,
              visitorRank: game.VisitorRank,
              predTempo: game.PredTempo,
              thrillScore: game.ThrillScore,
            },
            fetched_at: new Date().toISOString(),
            is_stale: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_key,external_game_id,game_date" }
        );

      upserted++;
    }

    await recordSyncSuccess("kenpom");
    return { ok: true, gamesUpserted: upserted, date };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure("kenpom", message);
    return { ok: false, error: message };
  }
}

// ─── DUNKS & THREES (NBA) ─────────────────────────────────────────────────────

export async function ingestDunksAndThreesPredictions(date: string) {
  const supabase = createServiceClient();
  const apiKey = process.env.DUNKS_AND_THREES_API_KEY;
  if (!apiKey) return { ok: false, error: "DUNKS_AND_THREES_API_KEY not configured" };

  try {
    const res = await fetch(
      `https://dunksandthrees.com/api/v1/game-predictions?date=${date}`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) throw new Error(`Dunks & Threes fetch failed: ${res.status}`);
    const games = await res.json();

    if (!Array.isArray(games)) throw new Error("Unexpected D&T response format");

    let upserted = 0;

    for (const game of games) {
      const homeWinProb = game.win_prob ?? null;
      const awayWinProb = homeWinProb !== null ? 1 - homeWinProb : null;
      const predictedTotal =
        game.p_home_score && game.p_away_score
          ? game.p_home_score + game.p_away_score
          : null;

      // Match to Odds API game by team name + date
      const { data: oddsMatch } = await supabase
        .from("market_odds")
        .select("external_game_id")
        .eq("sport_key", "nba")
        .eq("market_type", "h2h")
        // NOTE: Use nextDay+12h window, NOT date+23:59:59Z
        // Late ET games (8pm-midnight ET) become next UTC day
        // e.g. 10:30pm ET = 02:30 UTC next day — would be missed otherwise
        .ilike("home_team", `%${game.home_team_name}%`)
        .ilike("away_team", `%${game.away_team_name}%`)
        .gte("updated_at", `${date}T00:00:00Z`)
        .limit(1)
        .maybeSingle();

      const externalGameId = oddsMatch?.external_game_id ?? String(game.game_id);

      console.log('[D&T match]', {
        home: game.home_team_name,
        away: game.away_team_name,
        matched: oddsMatch?.external_game_id ?? 'NO MATCH'
      })

      await supabase
        .from("model_outputs")
        .upsert(
          {
            sport_key: "nba",
            source_key: "dunks_and_threes",
            external_game_id: externalGameId,
            game_date: date,
            home_team: game.home_team_name,
            away_team: game.away_team_name,
            home_win_probability: homeWinProb,
            away_win_probability: awayWinProb,
            predicted_home_score: game.p_home_score ?? null,
            predicted_away_score: game.p_away_score ?? null,
            predicted_total: predictedTotal,
            model_metadata: {
              homeRest: game.home_rest,
              awayRest: game.away_rest,
              statusId: game.status_id,
            },
            fetched_at: new Date().toISOString(),
            is_stale: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_key,external_game_id,game_date" }
        );

      upserted++;
    }

    await recordSyncSuccess("dunks_and_threes");
    return { ok: true, gamesUpserted: upserted, date };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure("dunks_and_threes", message);
    return { ok: false, error: message };
  }
}

// ─── MLB MARKET PROXY ─────────────────────────────────────────────────────────

export async function ingestMlbMarketProxy(date: string) {
  const supabase = createServiceClient();

  try {
    // Use market odds as the model proxy for MLB
    // NOTE: Use nextDay+12h window, NOT date+23:59:59Z
    // Late ET games (8pm-midnight ET) become next UTC day
    // e.g. 10:30pm ET = 02:30 UTC next day — would be missed otherwise
    const nextDay = new Date(new Date(`${date}T12:00:00`).getTime() + 86400000).toISOString().split("T")[0];
    const { data: allOdds } = await supabase
      .from("market_odds")
      .select("external_game_id, home_team, away_team, home_price, away_price, commence_time, bookmaker")
      .eq("sport_key", "mlb")
      .eq("market_type", "h2h")
      .eq("closing_line", false)
      .in("bookmaker", ["draftkings", "fanduel"])
      .gte("commence_time", `${date}T00:00:00Z`)
      .lt("commence_time", `${nextDay}T12:00:00Z`)
      .gte("updated_at", `${date}T00:00:00Z`);

    if (!allOdds || allOdds.length === 0) {
      return { ok: true, gamesUpserted: 0, note: "No MLB odds found for date" };
    }

    // Deduplicate: one row per game, prefer draftkings over fanduel
    const gameMap = new Map<string, typeof allOdds[0]>();
    for (const row of allOdds) {
      const existing = gameMap.get(row.external_game_id);
      if (!existing || (existing.bookmaker !== "draftkings" && row.bookmaker === "draftkings")) {
        gameMap.set(row.external_game_id, row);
      }
    }
    const odds = Array.from(gameMap.values());

    let upserted = 0;

    for (const game of odds) {
      if (!game.home_price || !game.away_price) continue;

      const homeImplied = americanToImpliedProb(game.home_price);
      const awayImplied = americanToImpliedProb(game.away_price);

      // Remove vig to get fair implied probabilities
      const total = homeImplied + awayImplied;
      const homeWinProb = homeImplied / total;
      const awayWinProb = awayImplied / total;

      await supabase
        .from("model_outputs")
        .upsert(
          {
            sport_key: "mlb",
            source_key: "baseball_savant",
            external_game_id: game.external_game_id,
            game_date: date,
            home_team: game.home_team,
            away_team: game.away_team,
            home_win_probability: homeWinProb,
            away_win_probability: awayWinProb,
            predicted_home_score: null,
            predicted_away_score: null,
            predicted_total: null,
            model_metadata: {
              proxy: true,
              note: `Market-implied probability from ${game.bookmaker} moneyline`,
              bookmaker: game.bookmaker,
              homePrice: game.home_price,
              awayPrice: game.away_price,
            },
            fetched_at: new Date().toISOString(),
            is_stale: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source_key,external_game_id,game_date" }
        );

      upserted++;
    }

    return { ok: true, gamesUpserted: upserted, date };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function ingestAllModelData(date: string) {
  const [kenpom, dunksAndThrees, mlbProxy] = await Promise.all([
    ingestKenpomPredictions(date),
    ingestDunksAndThreesPredictions(date),
    ingestMlbMarketProxy(date),
  ]);

  return { kenpom, dunksAndThrees, mlbProxy };
}
