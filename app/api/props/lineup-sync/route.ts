import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLogicalGameDate } from "@/lib/utils/dateUtils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getLogicalGameDate();

  const scheduleRes = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${today}&hydrate=lineups,probablePitcher`,
    { cache: "no-store" }
  ).then(r => r.json()).catch(() => ({ dates: [] }));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let gamesTotal = 0;
  let gamesWithLineups = 0;
  const upserts: any[] = [];

  for (const dateEntry of scheduleRes.dates ?? []) {
    for (const game of dateEntry.games ?? []) {
      gamesTotal++;
      const homeLineup: any[] = game.lineups?.homePlayers ?? [];
      const awayLineup: any[] = game.lineups?.awayPlayers ?? [];
      if (homeLineup.length > 0 || awayLineup.length > 0) gamesWithLineups++;

      upserts.push({
        game_pk: game.gamePk,
        game_date: today,
        home_team: game.teams?.home?.team?.name ?? "",
        away_team: game.teams?.away?.team?.name ?? "",
        home_pitcher: game.teams?.home?.probablePitcher?.fullName ?? null,
        away_pitcher: game.teams?.away?.probablePitcher?.fullName ?? null,
        home_lineup: homeLineup,
        away_lineup: awayLineup,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("mlb_lineup_cache")
      .upsert(upserts, { onConflict: "game_pk" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, date: today, gamesTotal, gamesWithLineups, timestamp: new Date().toISOString() });
}
