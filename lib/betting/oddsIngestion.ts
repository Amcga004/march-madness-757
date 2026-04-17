import { createServiceClient } from "@/lib/supabase/service";
import { recordSyncSuccess, recordSyncFailure, saveSnapshot } from "@/lib/platform/sourceRegistry";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

const SPORT_MAP = {
  nba: "basketball_nba",
  mlb: "baseball_mlb",
  ncaab: "basketball_ncaab",
} as const;

const BOOKMAKERS = "draftkings,fanduel,betmgm,caesars,williamhill_us,pointsbetus";

async function fetchOdds(sportKey: string): Promise<any[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY not configured");

  const url = `${ODDS_API_BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&bookmakers=${BOOKMAKERS}&oddsFormat=american`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Odds API fetch failed: ${res.status}`);
  return res.json();
}

function americanToImpliedProb(american: number): number {
  if (american > 0) {
    return 100 / (american + 100);
  } else {
    return Math.abs(american) / (Math.abs(american) + 100);
  }
}

function findBestLine(
  games: any[],
  gameId: string,
  marketType: string,
  side: "home" | "away" | "over" | "under"
): { price: number; bookmaker: string } | null {
  let best: { price: number; bookmaker: string } | null = null;

  const game = games.find((g) => g.id === gameId);
  if (!game) return null;

  for (const bookmaker of game.bookmakers ?? []) {
    const market = bookmaker.markets?.find((m: any) => m.key === marketType);
    if (!market) continue;

    for (const outcome of market.outcomes ?? []) {
      const isMatch =
        (side === "over" && outcome.name === "Over") ||
        (side === "under" && outcome.name === "Under") ||
        (side === "home" && outcome.name === game.home_team) ||
        (side === "away" && outcome.name === game.away_team);

      if (!isMatch) continue;

      const price = outcome.price;
      if (best === null) {
        best = { price, bookmaker: bookmaker.key };
      } else {
        // Best line for bettor: highest price (least negative or most positive)
        if (price > best.price) {
          best = { price, bookmaker: bookmaker.key };
        }
      }
    }
  }

  return best;
}

export async function ingestOddsForSport(sport: keyof typeof SPORT_MAP) {
  const supabase = createServiceClient();
  const oddsApiSportKey = SPORT_MAP[sport];
  const sourceKey = `odds_api_${sport}`;

  try {
    const games = await fetchOdds(oddsApiSportKey);
    await saveSnapshot(sourceKey, sport, "odds", { gameCount: games.length });

    let upserted = 0;

    for (const game of games) {
      const commenceTime = game.commence_time;
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const externalGameId = game.id;

      // Try to match to platform event
      const { data: platformEvent } = await supabase
        .from("platform_events")
        .select("id")
        .eq("sport_key", sport)
        .contains("metadata", { espnEventId: externalGameId })
        .maybeSingle();

      for (const bookmaker of game.bookmakers ?? []) {
        for (const market of bookmaker.markets ?? []) {
          const marketType = market.key as "h2h" | "spreads" | "totals";
          const outcomes = market.outcomes ?? [];

          let homePrice: number | null = null;
          let awayPrice: number | null = null;
          let overPrice: number | null = null;
          let underPrice: number | null = null;
          let spreadHome: number | null = null;
          let spreadAway: number | null = null;
          let lineValue: number | null = null;

          for (const outcome of outcomes) {
            if (marketType === "h2h") {
              if (outcome.name === homeTeam) homePrice = outcome.price;
              if (outcome.name === awayTeam) awayPrice = outcome.price;
            } else if (marketType === "spreads") {
              if (outcome.name === homeTeam) {
                homePrice = outcome.price;
                spreadHome = outcome.point ?? null;
              }
              if (outcome.name === awayTeam) {
                awayPrice = outcome.price;
                spreadAway = outcome.point ?? null;
              }
            } else if (marketType === "totals") {
              if (outcome.name === "Over") {
                overPrice = outcome.price;
                lineValue = outcome.point ?? null;
              }
              if (outcome.name === "Under") {
                underPrice = outcome.price;
              }
            }
          }

          await supabase
            .from("market_odds")
            .upsert(
              {
                sport_key: sport,
                event_id: platformEvent?.id ?? null,
                external_game_id: externalGameId,
                external_source: "odds_api",
                commence_time: commenceTime,
                home_team: homeTeam,
                away_team: awayTeam,
                bookmaker: bookmaker.key,
                market_type: marketType,
                home_price: homePrice,
                away_price: awayPrice,
                over_price: overPrice,
                under_price: underPrice,
                spread_home: spreadHome,
                spread_away: spreadAway,
                line_value: lineValue,
                fetched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "external_game_id,bookmaker,market_type" }
            );

          upserted++;
        }
      }
    }

    await recordSyncSuccess(sourceKey);
    return { ok: true, sport, gamesFound: games.length, oddsUpserted: upserted };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure(sourceKey, message);
    return { ok: false, sport, error: message };
  }
}

export async function ingestAllOdds() {
  const results = await Promise.all([
    ingestOddsForSport("nba"),
    ingestOddsForSport("mlb"),
    ingestOddsForSport("ncaab"),
  ]);
  return results;
}

export { americanToImpliedProb, findBestLine };
