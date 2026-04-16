import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEspnScoreboard, normalizeEspnEvent } from "@/lib/espn";
import { requireUser } from "@/lib/requireAuth";

function getTodayEasternLikeDateString() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authHeader = request.headers.get("authorization");
    const expected = process.env.CRON_SECRET;

    if (!expected || authHeader !== `Bearer ${expected}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const date = typeof body?.date === "string" && body.date.trim()
      ? body.date.trim()
      : getTodayEasternLikeDateString();

    const scoreboard = await fetchEspnScoreboard(date);
    const events = scoreboard.events ?? [];

    let upserted = 0;

    for (const event of events) {
      const normalized = normalizeEspnEvent(event);
      if (!normalized) continue;

      const { error } = await supabase.from("external_game_sync").upsert(
        {
          provider: normalized.provider,
          sport: "mens-college-basketball",
          external_game_id: normalized.external_game_id,
          espn_event_name: normalized.espn_event_name,
          espn_status: normalized.espn_status,
          espn_period: normalized.espn_period,
          espn_clock: normalized.espn_clock,
          start_time: normalized.start_time,
          home_team_external_id: normalized.home_team_external_id,
          away_team_external_id: normalized.away_team_external_id,
          home_team_name: normalized.home_team_name,
          away_team_name: normalized.away_team_name,
          home_score: normalized.home_score,
          away_score: normalized.away_score,
          last_synced_at: new Date().toISOString(),
          raw_payload: normalized.raw_payload,
        },
        {
          onConflict: "provider,external_game_id",
        }
      );

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      upserted += 1;
    }

    return NextResponse.json({
      ok: true,
      date,
      eventsSeen: events.length,
      rowsUpserted: upserted,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to sync ESPN scoreboard.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}