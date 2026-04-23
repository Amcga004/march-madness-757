import { NextRequest, NextResponse } from "next/server";
import { ingestAllOdds } from "@/lib/betting/oddsIngestion";
import { ingestAllModelData } from "@/lib/betting/modelIngestion";
import { ingestAllStats } from "@/lib/betting/statsIngestion";
import { runFullBettingSync } from "@/lib/betting/evEngine";
import { getLogicalGameDate } from "@/lib/utils/dateUtils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Step 1 — Ingest odds first (models depend on odds for MLB proxy)
    const odds = await ingestAllOdds();

    // Step 2 — Ingest models (MLB proxy reads from market_odds)
    const today = getLogicalGameDate();
    const models = await ingestAllModelData(today);

    // Step 3 — Ingest stats in parallel (independent)
    const stats = await ingestAllStats();

    // Step 4 — Compute consensus and signals
    const sync = await runFullBettingSync(today);

    return NextResponse.json({
      ok: true,
      date: today,
      odds,
      models,
      stats,
      sync,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
