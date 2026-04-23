import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLogicalGameDate } from "@/lib/utils/dateUtils";

export const dynamic = "force-dynamic";

function normalizeTeam(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

async function fetchEspn(path: string, dateStr: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${dateStr}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.events ?? [];
  } catch { return []; }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = getLogicalGameDate();
  const dateStr = today.replace(/-/g, "");

  // Fetch all ESPN sports in parallel (free, no API key)
  const [nbaEvents, mlbEvents, nhlEvents, ncaabEvents] = await Promise.all([
    fetchEspn("basketball/nba", dateStr),
    fetchEspn("baseball/mlb", dateStr),
    fetchEspn("hockey/nhl", dateStr),
    fetchEspn("basketball/mens-college-basketball", dateStr),
  ]);

  // Collect normalized team keys for live/final games
  const liveGameKeys = new Set<string>();
  const allEvents = [...nbaEvents, ...mlbEvents, ...nhlEvents, ...ncaabEvents];

  for (const event of allEvents) {
    const state = event.status?.type?.state;
    if (state !== "in" && state !== "post") continue;

    const comp = event.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeName = home.team?.displayName;
    const awayName = away.team?.displayName;
    if (!homeName || !awayName) continue;

    liveGameKeys.add(`${normalizeTeam(awayName)}|${normalizeTeam(homeName)}`);
  }

  if (liveGameKeys.size === 0) {
    return NextResponse.json({ ok: true, liveGames: 0, suppressed: 0, date: today });
  }

  // Fetch all unsuppressed signals for today and match by team names
  const { data: signals } = await supabase
    .from("signals")
    .select("id, home_team, away_team")
    .eq("game_date", today)
    .eq("suppressed", false);

  const idsToSuppress = (signals ?? [])
    .filter((s: any) => liveGameKeys.has(`${normalizeTeam(s.away_team)}|${normalizeTeam(s.home_team)}`))
    .map((s: any) => s.id);

  let suppressed = 0;
  if (idsToSuppress.length > 0) {
    await supabase
      .from("signals")
      .update({ suppressed: true, suppression_reason: "game_live", updated_at: new Date().toISOString() })
      .in("id", idsToSuppress);
    suppressed = idsToSuppress.length;
  }

  return NextResponse.json({
    ok: true,
    date: today,
    liveGames: liveGameKeys.size,
    suppressed,
    timestamp: new Date().toISOString(),
  });
}
