import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEspnScoreboard, normalizeEspnEvent } from "@/lib/espn";
import { mapEspnTeamsToInternal } from "@/lib/teamMapping";
import { promoteResults } from "@/lib/promoteResults";

function formatDateToYYYYMMDD(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function getTodayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function buildRollingDateWindow(daysBack = 2, daysForward = 5) {
  const base = getTodayUtcDate();
  const dates: string[] = [];

  for (let offset = -daysBack; offset <= daysForward; offset += 1) {
    const next = new Date(base);
    next.setUTCDate(base.getUTCDate() + offset);
    dates.push(formatDateToYYYYMMDD(next));
  }

  return dates;
}

function parseRequestedDates(body: unknown) {
  if (!body || typeof body !== "object") {
    return buildRollingDateWindow();
  }

  const maybeBody = body as {
    date?: unknown;
    dates?: unknown;
  };

  if (Array.isArray(maybeBody.dates)) {
    const cleaned = maybeBody.dates
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => /^\d{8}$/.test(value));

    return cleaned.length > 0 ? cleaned : buildRollingDateWindow();
  }

  if (typeof maybeBody.date === "string" && /^\d{8}$/.test(maybeBody.date.trim())) {
    return [maybeBody.date.trim()];
  }

  return buildRollingDateWindow();
}

export async function POST(request: NextRequest) {
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
    const requestedDates = parseRequestedDates(body);

    let totalEventsSeen = 0;
    let totalRowsUpserted = 0;

    for (const date of requestedDates) {
      const scoreboard = await fetchEspnScoreboard(date);
      const events = scoreboard.events ?? [];

      totalEventsSeen += events.length;

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
          throw new Error(error.message);
        }

        totalRowsUpserted += 1;
      }
    }

    const mappingResult = await mapEspnTeamsToInternal();
    const promotionResult = await promoteResults();

    return NextResponse.json({
      ok: true,
      datesProcessed: requestedDates,
      eventsSeen: totalEventsSeen,
      rowsUpserted: totalRowsUpserted,
      mappedRows: mappingResult.mappedRows,
      promotedGames: promotionResult.promotedGames,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to run sync cycle.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}