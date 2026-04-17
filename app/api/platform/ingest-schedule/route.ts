import { NextRequest, NextResponse } from "next/server";
import { ingestAllEspnSchedules } from "@/lib/platform/ingestion/espnSchedule";
import { ingestGolfTournaments, ingestGolfPlayers } from "@/lib/platform/ingestion/golfSchedule";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [espnResults, golfTournaments, golfPlayers] = await Promise.all([
      ingestAllEspnSchedules(),
      ingestGolfTournaments("2026"),
      ingestGolfPlayers(),
    ]);

    return NextResponse.json({
      ok: true,
      espn: espnResults,
      golf: {
        tournaments: golfTournaments,
        players: golfPlayers,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
